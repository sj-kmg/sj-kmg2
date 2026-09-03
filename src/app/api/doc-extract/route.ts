import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { aiAvailable, extractWithAi } from '@/lib/docAi';
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

/** Gemini가 직접 읽을 수 있는 형식 — PDF와 이미지 */
const MEDIA_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);



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
  if (!aiAvailable() || enough) {
    return NextResponse.json({ fields: textResult, source: enough ? 'text' : 'text-only' });
  }

  const object = await extractWithAi(file.data, file.mediaType, hint);
  if (!object) {
    // AI가 실패해도 글자층에서 얻은 값은 돌려준다
    return NextResponse.json({ fields: textResult, source: 'text-fallback' });
  }

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

}
