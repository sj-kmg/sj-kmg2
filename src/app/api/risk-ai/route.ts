import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * 위험성평가 AI 자동 생성 API — 작업 사진을 보고 평가표 초안(작업단계·유해위험요인·안전조치 등)을 생성한다.
 * 우선순위:
 * 1) GOOGLE_GENERATIVE_AI_API_KEY 설정 시 Google Gemini 무료 등급 사용 (카드 불필요, 과금 없음)
 * 2) 없으면 Vercel AI Gateway (배포 환경 OIDC 인증 — 단, 사진 분석 모델은 유료 크레딧 필요)
 * 외부 호출 방지를 위해 기록 API와 같은 동기화 암호(x-passcode)를 요구한다.
 */
export const maxDuration = 300;

const USE_GEMINI = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
// gemini-flash-latest: 항상 최신 Flash 모델을 가리키는 별칭 — 구모델 은퇴로 인한 중단을 방지
const GEMINI_MODEL = process.env.RISK_AI_MODEL ?? 'gemini-flash-latest';
const GATEWAY_MODEL = process.env.RISK_AI_MODEL ?? 'anthropic/claude-sonnet-5';

const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const RowSchema = z.object({
  step: z.string().describe('작업단계 (짧게)'),
  hazard: z.string().describe('유해위험요인 — 무엇 때문에 어떤 재해가 날 수 있는지'),
  measure: z.string().describe('현재 안전조치 (일반적으로 시행 중인 조치)'),
  freq1: z.number().int().describe('현재 빈도 1~5'),
  sev1: z.number().int().describe('현재 강도 1~4'),
  action: z.string().describe('개선대책'),
  freq2: z.number().int().describe('개선 후 빈도 1~5'),
  sev2: z.number().int().describe('개선 후 강도 1~4'),
  timing: z.enum(['작업 전', '작업 중', '작업 후']).describe('개선 적용 시점'),
});
const OutputSchema = z.object({ rows: z.array(RowSchema) });

const SYSTEM = `당신은 전남 여수시 산업설비 세정·정비 전문업체 ㈜신정개발의 안전관리자다.
첨부된 작업 현장 사진을 보고 빈도·강도법 위험성평가표 초안을 작성한다.

규칙:
- 사진에서 확인되는 작업과 그 전후에 통상 수반되는 작업단계를 순서대로 나눠 평가한다 (보통 4~8개 항목).
- 유해위험요인은 "~로 인한 ~(재해형태)" 식으로 구체적으로 쓴다 (예: 고압세척 호스 파단으로 인한 비래·타격).
- 현재 안전조치는 해당 작업에서 일반적으로 시행하는 조치를 쓴다.
- 빈도(1~5): 1=10년1회, 2=3년1회, 3=1년1회, 4=1개월1회, 5=1일1회 수준의 발생 가능성.
- 강도(1~4): 1=영향없음, 2=경미한 불휴업재해, 3=경미한 휴업재해, 4=중대재해(사망·노동력 상실).
- 개선대책 적용 시 낮아지는 빈도·강도를 개선 후 값으로 제시한다 (통상 빈도가 낮아진다).
- 모든 문구는 한국어로, 표 칸에 들어갈 만큼 간결하게 쓴다.
- 확인되지 않는 사항을 단정하지 말고, 사진의 실제 작업 환경(장비·보호구·주변 여건)을 반영한다.`;

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m || !MEDIA_TYPES.has(m[1].toLowerCase())) return null;
  return { mediaType: m[1].toLowerCase(), data: m[2] };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(Math.round(v), min), max);

export async function POST(req: Request) {
  // Gemini 키가 있으면 어디서든 동작, 없으면 Vercel 배포 환경(AI Gateway OIDC)에서만 동작
  const hasGateway = !!(process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  if (!USE_GEMINI && !hasGateway) {
    return NextResponse.json({ error: 'ai_not_configured' }, { status: 503 });
  }
  const pass = process.env.SJ_PASSCODE;
  if (!pass) {
    return NextResponse.json({ error: 'passcode_not_configured' }, { status: 503 });
  }
  if (req.headers.get('x-passcode') !== pass) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { photos?: unknown; context?: unknown };
  try {
    body = (await req.json()) as { photos?: unknown; context?: unknown };
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .filter((p): p is string => typeof p === 'string')
    .slice(0, 3)
    .map(parseDataUrl)
    .filter((p): p is { mediaType: string; data: string } => p !== null);
  if (photos.length === 0) {
    return NextResponse.json({ error: 'no_photos' }, { status: 400 });
  }
  const context = typeof body.context === 'string' ? body.context.slice(0, 500) : '';

  try {
    const { object } = await generateObject({
      model: USE_GEMINI ? google(GEMINI_MODEL) : GATEWAY_MODEL,
      system: SYSTEM,
      maxOutputTokens: 8000,
      schema: OutputSchema,
      messages: [
        {
          role: 'user',
          content: [
            ...photos.map((p) => ({ type: 'image' as const, image: p.data, mediaType: p.mediaType })),
            {
              type: 'text' as const,
              text:
                (context ? `작업 정보: ${context}\n` : '') +
                '첨부한 작업 사진을 바탕으로 위험성평가표 초안을 작성해줘.',
            },
          ],
        },
      ],
    });
    const rows = object.rows.map((r) => ({
      ...r,
      freq1: clamp(r.freq1, 1, 5),
      sev1: clamp(r.sev1, 1, 4),
      freq2: clamp(r.freq2, 1, 5),
      sev2: clamp(r.sev2, 1, 4),
    }));
    return NextResponse.json({ rows });
  } catch (e) {
    console.error('risk-ai generation failed:', e);
    const msg = e instanceof Error ? e.message : String(e);
    let code = 'generation_failed';
    if (/credit|quota|payment required|402/i.test(msg)) code = 'no_credit';
    else if (/oidc|authenticat|api key|unauthoriz/i.test(msg)) code = 'gateway_auth';
    else if (/model/i.test(msg) && /not found|not available|invalid/i.test(msg)) code = 'bad_model';
    return NextResponse.json({ error: code, detail: msg.slice(0, 300) }, { status: 502 });
  }
}

/** 배포 상태 확인용 — 사용 엔진·모델 노출 (AI 호출 없음). ?models=1 로 이 키에서 쓸 수 있는 Gemini 모델 목록 조회 */
export async function GET(req: Request) {
  const wantModels = new URL(req.url).searchParams.get('models');
  if (wantModels && USE_GEMINI) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
      );
      const data = (await r.json()) as {
        models?: { name: string; supportedGenerationMethods?: string[] }[];
      };
      const models = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''));
      return NextResponse.json({ models });
    } catch {
      return NextResponse.json({ error: 'list_failed' }, { status: 502 });
    }
  }
  return NextResponse.json({
    ok: true,
    engine: USE_GEMINI ? 'gemini-free' : 'ai-gateway',
    model: USE_GEMINI ? GEMINI_MODEL : GATEWAY_MODEL,
  });
}
