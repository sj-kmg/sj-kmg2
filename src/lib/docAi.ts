/**
 * 서류 AI 판독 — 스캔본·사진처럼 글자층이 없는 서류를 그림째 읽는다.
 *
 * GOOGLE_GENERATIVE_AI_API_KEY가 있어야 동작하고, 없으면 null을 돌려준다.
 * 첨부서류 자동입력(/api/doc-extract)과 이미 붙어 있는 서류 다시 읽기(/api/certs/read-period)가
 * 같은 지시문·같은 형식을 쓰도록 여기 한곳에 둔다.
 */
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const AI_MODEL = process.env.RISK_AI_MODEL ?? 'gemini-flash-latest';

/** AI를 쓸 수 있는 상태인가 (키가 등록돼 있는가) */
export function aiAvailable(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

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

export type AiDocFields = z.infer<typeof Schema>;

export { Schema as AI_DOC_SCHEMA };

/**
 * 서류 한 건을 AI로 읽는다 — 실패하면 null (부르는 쪽은 글자층 결과로 넘어간다).
 * @param hint '자동차등록증'처럼 어떤 서류로 첨부됐는지
 */
export async function extractWithAi(
  data: string,
  mediaType: string,
  hint: string,
): Promise<AiDocFields | null> {
  if (!aiAvailable()) return null;
  try {
    const { object } = await generateObject({
      model: google(AI_MODEL),
      system: SYSTEM,
      maxOutputTokens: 1200,
      schema: Schema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'file' as const, data, mediaType },
            {
              type: 'text' as const,
              text: (hint ? `이 서류는 ${hint}로 첨부됐다.
` : '') + '이 서류에서 항목을 뽑아줘.',
            },
          ],
        },
      ],
    });
    return object;
  } catch (e) {
    console.error('AI 판독 실패:', e);
    return null;
  }
}
