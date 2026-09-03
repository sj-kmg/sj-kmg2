import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAuth } from '@/lib/auth';
import { fieldsFromText } from '@/lib/docText';
import { pdfText } from '@/lib/pdfRender';

/**
 * 첨부서류 자동 판독 API — 수료증·이수증·검진결과·자동차등록증 같은 서류를 읽어
 * 화면의 입력칸에 들어갈 값(성명·생년월일·연락처·일자·차량번호 등)을 뽑아 준다.
 *
 * 화면에서는 파일을 올린 직후 이 API를 부르고, "비어 있는 칸만" 채운다.
 * 이미 사람이 적어 둔 값은 절대 덮어쓰지 않는다 (판독은 어디까지나 보조 수단).
 *
 * 읽는 방법은 두 가지다.
 *  1) **글자층 읽기** — 협회·관공서가 발급한 전자 PDF에는 글자가 그대로 들어 있어
 *     별도 설정 없이 바로 읽는다. 적혀 있는 값을 그대로 가져오므로 가장 정확하다.
 *  2) **AI 판독** — 스캔본·사진처럼 글자층이 없는 서류용.
 *     GOOGLE_GENERATIVE_AI_API_KEY가 있어야 하고, 없으면 1)만 동작한다.
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
  phone: z.string().nullable().describe('휴대폰 번호 010-0000-0000 — 없으면 null'),
  hazards: z.string().nullable().describe('「유해인자」 칸에 적힌 물질 목록을 적힌 그대로 (쉼표 구분) — 없으면 null'),
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
- 건강진단 결과서·확인서: 검진을 받은 날을 issuedAt으로 본다.
  「유해인자」 칸이 있으면 거기 적힌 물질 목록을 **줄이거나 요약하지 말고 그대로** hazards에 넣는다.
  (물질마다 다시 검진해야 하는 주기가 달라, 어떤 물질이 적혀 있었는지가 중요하다)
- 자동차등록증: 차량번호를 plate에 넣는다.
  「4. 검사유효기간」 표에는 줄이 여러 개 있고, 인쇄된 첫 줄은 **최초 검사기간**이라 대개 이미 지났다.
  갱신할 때마다 손으로 한 줄씩 덧붙이므로, **표에서 가장 나중 날짜가 적힌 줄**을 찾아
  그 줄의 「연월일부터」를 periodStart, 「연월일까지」를 periodEnd에 넣는다.
  손글씨가 흐리거나 겹쳐 있어 연도를 확신할 수 없으면 **반드시 null로 둔다** — 틀린 날짜를 넣으면
  기간이 지난 서류를 유효한 것으로 잘못 보여 주게 되므로, 비워 두는 편이 낫다.
- 보험증권·보험가입증권: 차량번호를 plate에, 「보험기간」·「의무보험기간」의 시작일을 periodStart,
  종료일을 periodEnd에 넣는다. 「까지」 앞에 적힌 날짜가 종료일이다.
- 주민등록번호·외국인등록번호가 보여도 앞 6자리로 생년월일만 만들고, 뒷자리는 어디에도 옮기지 않는다.
  (뒷자리 첫 숫자가 1·2·5·6이면 19xx년, 3·4·7·8이면 20xx년생이다.)
- 연락처·전화번호·휴대폰 칸에 010으로 시작하는 번호가 있으면 phone에 010-0000-0000 형태로 넣는다.
  사업장 대표번호(02·061 등)나 발급기관 전화번호는 넣지 않는다.
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

/** 휴대폰 번호를 010-0000-0000 형태로 — 그 외 번호는 버린다 */
function cleanPhone(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  if (!/^01[016789]\d{7,8}$/.test(d)) return null;
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/**
 * PDF 글자층 읽기 — 전자 서류면 여기서 값이 그대로 나온다.
 * 스캔본이면 글자가 없어 빈 값이 나오고, 그때만 AI 판독으로 넘어간다.
 */
async function readPdfText(base64: string): Promise<string> {
  // 글꼴·cMap 위치를 명시하는 경로 — 안 그러면 배포본에서 한글이 깨져 나온다
  return pdfText(Buffer.from(base64, 'base64'));
}

export async function POST(req: Request) {
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

  // 1단계 — 글자층. 전자 PDF면 여기서 적힌 값을 그대로 얻는다 (AI 키 없이도 동작)
  const fromText =
    file.mediaType === 'application/pdf'
      ? fieldsFromText(await readPdfText(file.data))
      : { personName: null, birth: null, phone: null, issuedAt: null, hazards: null };

  const textResult = {
    docType: null as string | null,
    personName: fromText.personName,
    birth: cleanDate(fromText.birth),
    phone: cleanPhone(fromText.phone),
    hazards: fromText.hazards,
    issuedAt: cleanDate(fromText.issuedAt),
    periodStart: null as string | null,
    periodEnd: null as string | null,
    plate: null as string | null,
    note: null as string | null,
  };

  // 글자층에서 필요한 값을 다 얻었으면 AI를 부르지 않는다 (더 정확하고 비용도 없다).
  // 검진 서류는 유해인자까지 있어야 갱신주기를 따질 수 있어 그것도 함께 본다.
  const needsHazards = /검진|확인서/.test(hint);
  const enough =
    !!textResult.personName && !!textResult.birth && (!needsHazards || !!textResult.hazards);
  if (!USE_GEMINI || enough) {
    return NextResponse.json({ fields: textResult, source: enough ? 'text' : 'text-only' });
  }

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

    // 서류에 적힌 글자(textResult)가 AI 판독보다 정확하므로 그쪽을 우선하고, 빈 칸만 AI로 채운다
    return NextResponse.json({
      fields: {
        docType: object.docType?.trim() || null,
        personName: textResult.personName ?? object.personName?.trim() ?? null,
        birth: textResult.birth ?? cleanDate(object.birth),
        phone: textResult.phone ?? cleanPhone(object.phone),
        hazards: textResult.hazards ?? object.hazards?.trim() ?? null,
        issuedAt: textResult.issuedAt ?? cleanDate(object.issuedAt),
        periodStart: cleanDate(object.periodStart),
        periodEnd: cleanDate(object.periodEnd),
        plate: object.plate?.replace(/\s+/g, '') || null,
        note: object.note?.trim() || null,
      },
      source: 'ai',
    });
  } catch (e) {
    console.error('doc-extract failed:', e);
    // AI가 실패해도 글자층에서 얻은 값은 돌려준다
    return NextResponse.json({ fields: textResult, source: 'text-fallback' });
  }
}
