import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

/**
 * 위험성평가 AI 자동 생성 API — 작업 사진을 보고 평가표 초안(작업단계·유해위험요인·안전조치 등)을 생성한다.
 * - ANTHROPIC_API_KEY 환경변수가 필요하다 (미설정 시 503 → 클라이언트가 안내 표시).
 * - 외부 호출 방지를 위해 기록 API와 같은 동기화 암호(x-passcode)를 요구한다.
 */
export const maxDuration = 60;

const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** 생성 결과 스키마 — 빈도 1~5 · 강도 1~4 · 개선시점 3택 */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows'],
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['step', 'hazard', 'measure', 'freq1', 'sev1', 'action', 'freq2', 'sev2', 'timing'],
        properties: {
          step: { type: 'string', description: '작업단계 (짧게)' },
          hazard: { type: 'string', description: '유해위험요인 — 무엇 때문에 어떤 재해가 날 수 있는지' },
          measure: { type: 'string', description: '현재 안전조치 (일반적으로 시행 중인 조치)' },
          freq1: { type: 'integer', enum: [1, 2, 3, 4, 5], description: '현재 빈도' },
          sev1: { type: 'integer', enum: [1, 2, 3, 4], description: '현재 강도' },
          action: { type: 'string', description: '개선대책' },
          freq2: { type: 'integer', enum: [1, 2, 3, 4, 5], description: '개선 후 빈도' },
          sev2: { type: 'integer', enum: [1, 2, 3, 4], description: '개선 후 강도' },
          timing: { type: 'string', enum: ['작업 전', '작업 중', '작업 후'], description: '개선 적용 시점' },
        },
      },
    },
  },
} as const;

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

interface GenRow {
  step: string;
  hazard: string;
  measure: string;
  freq1: number;
  sev1: number;
  action: string;
  freq2: number;
  sev2: number;
  timing: string;
}

function parseDataUrl(dataUrl: string): { media_type: string; data: string } | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m || !MEDIA_TYPES.has(m[1].toLowerCase())) return null;
  return { media_type: m[1].toLowerCase(), data: m[2] };
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
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
    .filter((p): p is { media_type: string; data: string } => p !== null);
  if (photos.length === 0) {
    return NextResponse.json({ error: 'no_photos' }, { status: 400 });
  }
  const context = typeof body.context === 'string' ? body.context.slice(0, 500) : '';

  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          ...photos.map((p) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: p.media_type as 'image/jpeg', data: p.data },
          })),
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

  if (response.stop_reason === 'refusal') {
    return NextResponse.json({ error: 'refused' }, { status: 502 });
  }
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  try {
    const parsed = JSON.parse(text) as { rows: GenRow[] };
    return NextResponse.json({ rows: parsed.rows ?? [] });
  } catch {
    return NextResponse.json({ error: 'bad_model_output' }, { status: 502 });
  }
}
