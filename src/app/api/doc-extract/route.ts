import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAuth } from '@/lib/auth';

/**
 * 첨부서류 자동 판독 API — 수료증·이수증·검진결과·자동차등록증 같은 서류를 읽어
 * 화면의 입력칸에 들어갈 값(성명·생년월일·일자·차량번호 등)을 뽑아 준다.
 *
 * 화면에서는 파일을 올린 직후 이 API를 부르고, "비어 있는 칸만" 채운다.
 * 이미 사람이 적어 둔 값은 절대 덮어쓰지 않는다 (판독은 어디까지나 보조 수단).
 *
 * GOOGLE_GENERATIVE_AI_API_KEY(Google AI Studio 키)로 Gemini를 호출하며,
 * 키가 없으면 503을 돌려주고 화면은 조용히 수동 입력으로 진행한다.
 */
export const maxDuration = 120;

const USE_GEMINI = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const MODEL = process.env.RISK_AI_MODEL ?? 'gemini-flash-latest';

/** Gemini가 직접 읽을 수 있는 형식 — PDF와 이미지 */
const MEDIA_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

/** 서류에서 뽑아내는 값 — 없으면 비워 둔다 (지어내지 않는다) */
const Schema = z.object({
  docType: z.string().nullable().describe('서류 종류 (예: 교육 이수증, 수료증, 건강진단 결과서, 자동차등록증, 보험가입증권)'),
  personName: z.string().nullable().describe('사람 이름 — 없으면 null'),
  birth: z.string().nullable().describe('생년월일 YYYY-MM-DD — 없으면 null'),
  issuedAt: z.string().nullable().describe('발급일·수료일·검진일 등 이 서류의 기준 일자 YYYY-MM-DD'),
  periodStart: z.string().nullable().describe('유효기간 시작일 YYYY-MM-DD — 없으면 null'),
  periodEnd: z.string().nullable().describe('유효기간 종료일·만료일 YYYY-MM-DD — 없으면 null'),
  plate: z.string().nullable().describe('차량번호 (예: 86저0128) — 없으면 null'),
  note: z.string().nullable().describe('과정명·교육구분처럼 짧은 부가 설명 — 없으면 null'),
});

const SYSTEM = `너는 한국 산업안전 서류를 읽어 항목을 뽑아내는 도구다.

규칙:
- 서류에 **적혀 있는 값만** 뽑는다. 보이지 않거나 확실하지 않으면 반드시 null로 둔다. 절대 추측하지 않는다.
- 모든 날짜는 YYYY-MM-DD로 바꾼다. "2026년 01월 08일" → "2026-01-08".
- 교육 이수증·수료증: 「교육 일자」의 **끝나는 날**을 issuedAt으로 본다.
  기간이 "2026년 01월 07일 ~ 2026년 01월 08일"이면 issuedAt은 2026-01-08.
  「집합교육 이수기한」처럼 앞으로의 기한은 periodEnd에 넣는다.
- 건강진단 결과서: 검진을 받은 날을 issuedAt으로 본다.
- 자동차등록증·보험가입증권: 차량번호를 plate에, 유효기간을 periodStart·periodEnd에 넣는다.
- 주민등록번호가 보여도 앞 6자리로 생년월일만 만들고, 뒷자리는 어디에도 옮기지 않는다.
  (앞자리 7번째 숫자가 1·2면 19xx년, 3·4면 20xx년생이다.)
- 이름은 사람 이름만 넣는다. 사업장·상호·대표자 이름은 personName이 아니다.`;

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m || !MEDIA_TYPES.has(m[1].toLowerCase())) return null;
  return { mediaType: m[1].toLowerCase(), data: m[2] };
}

/** YYYY-MM-DD 형태이고 상식적인 범위인 날짜만 통과시킨다 */
function cleanDate(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 1900 || y > new Date().getFullYear() + 30) return null;
  if (Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  if (Number(m[3]) < 1 || Number(m[3]) > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export async function POST(req: Request) {
  if (!USE_GEMINI) {
    return NextResponse.json({ error: 'ai_not_configured' }, { status: 503 });
  }
  // 기록 API와 같은 자격으로 막는다 — 열람 전용 계정은 쓸 수 없다
  const auth = await checkAuth(req);
  if (auth.notConfigured) {
    return NextResponse.json({ error: 'passcode_not_configured' }, { status: 503 });
  }
  if (!auth.role) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (auth.role === 'viewer') {
    return NextResponse.json({ error: 'read_only' }, { status: 403 });
  }

  let body: { dataUrl?: unknown; hint?: unknown };
  try {
    body = (await req.json()) as { dataUrl?: unknown; hint?: unknown };
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const file = typeof body.dataUrl === 'string' ? parseDataUrl(body.dataUrl) : null;
  if (!file) {
    return NextResponse.json({ error: 'bad_file' }, { status: 400 });
  }
  if (Buffer.byteLength(file.data, 'base64') > 8_000_000) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  const hint = typeof body.hint === 'string' ? body.hint.slice(0, 200) : '';

  try {
    const { object } = await generateObject({
      model: google(MODEL),
      system: SYSTEM,
      maxOutputTokens: 1200,
      schema: Schema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'file' as const, data: file.data, mediaType: file.mediaType },
            {
              type: 'text' as const,
              text: (hint ? `이 서류는 ${hint}로 첨부됐다.\n` : '') + '이 서류에서 항목을 뽑아줘.',
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      fields: {
        docType: object.docType?.trim() || null,
        personName: object.personName?.trim() || null,
        birth: cleanDate(object.birth),
        issuedAt: cleanDate(object.issuedAt),
        periodStart: cleanDate(object.periodStart),
        periodEnd: cleanDate(object.periodEnd),
        plate: object.plate?.replace(/\s+/g, '') || null,
        note: object.note?.trim() || null,
      },
    });
  } catch (e) {
    console.error('doc-extract failed:', e);
    return NextResponse.json({ error: 'extract_failed' }, { status: 502 });
  }
}
