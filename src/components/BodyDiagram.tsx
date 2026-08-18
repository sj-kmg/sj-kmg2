'use client';

import { BODY_POINTS, matchBodyPoints } from '@/lib/healthFollowup';

/**
 * 유소견자 신체도 — 해부 모형풍 인체에 검진소견 부위를 표시하고,
 * 오른쪽에 장기 그림·부위명·소견을 줄로 잇는다.
 *
 * 좌표계: 인체는 중심선 x=100을 기준으로 좌우 대칭이라 왼쪽 절반만 그리고
 * transform으로 뒤집어 붙인다 (경계가 어긋나지 않고 파일도 짧아진다).
 */

/** 인체 왼쪽 절반 — 목→어깨→팔→몸통→다리, 중심선(x=100)으로 닫는다 */
const BODY_HALF =
  'M100,64 L88,66 C88,74 87,80 82,86 C70,90 55,95 45,104 C36,111 32,121 31,133 ' +
  'C28,150 25,168 22,186 C20,196 18,206 17,216 C14,232 12,248 10,262 ' +
  'C9,272 8,282 9,290 C11,302 24,304 27,292 C29,282 30,272 31,262 ' +
  'C34,246 37,230 40,214 C41,204 43,194 44,184 C48,166 50,148 52,132 ' +
  'C53,124 55,116 58,112 C60,128 61,142 62,156 C63,170 63,182 62,194 ' +
  'C61,204 60,212 60,220 C59,232 58,244 58,256 C58,276 59,300 60,322 ' +
  'C61,336 62,350 63,364 C64,384 65,404 66,420 C66,430 67,438 68,442 ' +
  'C70,450 84,450 86,442 C87,428 88,412 88,396 C88,374 89,350 90,326 ' +
  'C91,302 93,278 95,262 C96,254 98,250 100,248 Z';

/** 근육 결 — 해부 모형처럼 몸의 굴곡을 얇은 선으로 나타낸다 (왼쪽 절반, 대칭 복제) */
const BODY_LINES = [
  'M80,92 C88,99 95,101 100,101',
  'M60,116 C70,133 87,139 100,137',
  'M100,159 L82,158',
  'M100,179 L82,178',
  'M100,199 L83,198',
  'M41,130 C38,158 34,186 31,212',
  'M28,230 C25,246 22,258 20,272',
  'M62,352 C70,357 80,357 86,352',
  'M74,268 C72,296 71,322 70,346',
  'M69,370 C68,394 68,414 68,432',
];

/** 장기 그림 — 32×32 기준, 실제 해부 일러스트 색상 */
const ORGAN: Record<string, React.ReactNode> = {
  brain: (
    <>
      <path
        d="M16 4.2c-4.6 0-8.6 2.2-10.4 5.5-2 .6-3.4 2.5-3.4 4.7 0 1.3.5 2.5 1.3 3.4-.4.8-.6 1.7-.6 2.6 0 3.1 2.4 5.6 5.5 5.9.9 1.9 2.9 3.2 5.2 3.2h4.8c2.3 0 4.3-1.3 5.2-3.2 3.1-.3 5.5-2.8 5.5-5.9 0-.9-.2-1.8-.6-2.6.8-.9 1.3-2.1 1.3-3.4 0-2.2-1.4-4.1-3.4-4.7C24.6 6.4 20.6 4.2 16 4.2z"
        fill="#F2A2B0"
      />
      <path d="M14.1 25.4h3.8v3.2a1.9 1.9 0 0 1-3.8 0z" fill="#DE879A" />
      <path
        d="M16 6.6v18.6M10.6 10.8c-2.1 1.1-2.1 3.8 0 4.9M21.4 10.8c2.1 1.1 2.1 3.8 0 4.9M9.4 18.8c1.9.95 3.8.95 5.4 0M22.6 18.8c-1.9.95-3.8.95-5.4 0"
        stroke="#D0728A"
        strokeWidth="1.15"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  lungs: (
    <>
      <path d="M16 3.4v8.4" stroke="#E9BDBD" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M16 11.4l-3.6 2.6M16 11.4l3.6 2.6" stroke="#E9BDBD" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path
        d="M13.6 13.8c-1.5-1.4-3.7-2-5.6-1.4-2.9.9-4.7 3.8-5 7l-.5 5.3c-.3 3.3 2.2 6.1 5.5 6.1 3.1 0 5.7-2.4 6-5.5l.6-7.8c.1-1.4-.2-2.6-1-3.7z"
        fill="#F09B9B"
      />
      <path
        d="M18.4 13.8c1.5-1.4 3.7-2 5.6-1.4 2.9.9 4.7 3.8 5 7l.5 5.3c.3 3.3-2.2 6.1-5.5 6.1-3.1 0-5.7-2.4-6-5.5l-.6-7.8c-.1-1.4.2-2.6 1-3.7z"
        fill="#F09B9B"
      />
      <path d="M8.8 19v6.5M23.2 19v6.5" stroke="#D97F7F" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </>
  ),
  heart: (
    <>
      <path
        d="M16 28.6l-2.3-2.1C6.9 20.3 2.4 16.2 2.4 11.1 2.4 7 5.6 3.8 9.7 3.8c2.4 0 4.6 1.1 6 2.9l.3.4.3-.4c1.4-1.8 3.6-2.9 6-2.9 4.1 0 7.3 3.2 7.3 7.3 0 5.1-4.5 9.2-11.3 15.4l-2.3 2.1z"
        fill="#E8404F"
      />
      <path
        d="M9.9 7.6c-1.8.1-3.2 1.6-3.3 3.5"
        stroke="#ffffff"
        strokeOpacity="0.6"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  liver: (
    <>
      <path
        d="M3.4 12.4c4.6-3.3 12.8-4.4 20-2.9 3.9.8 6 3.5 5.3 7.2-.9 4.7-5.6 9.2-12.2 10-6.4.8-12.1-2.5-13.6-7.2-.7-2.4-.7-4.9.5-7.1z"
        fill="#A6564A"
      />
      <path d="M15.9 10.1l1.6 6.7" stroke="#87403A" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M12.4 24.2c1.3 1.7 3.3 2.3 4.9 1.6" stroke="#7FB069" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </>
  ),
  stomach: (
    <>
      <path
        d="M11.2 4.2c-1.15 0-2.1.95-2.1 2.1v6.7c0 6.4 3.2 11 8.5 12.2 4.6.95 8.5-2.1 8.5-6.5 0-4-3.1-6.9-7.1-6.9a2.1 2.1 0 0 0 0 4.2c1.75 0 3 1.25 3 3 0 2.05-1.75 3.3-3.9 2.85-3.3-.7-5.3-3.8-5.3-8.25V6.3c0-1.15-.95-2.1-1.95-2.1z"
        fill="#EDA07F"
      />
      <path d="M11.3 8.8h3" stroke="#D2825E" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </>
  ),
  gut: (
    <>
      <path
        d="M10.2 4.6v3.4c0 2.2 1.8 4 4 4h4.6c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4.6c-2.2 0-4 1.8-4 4v3.8"
        stroke="#EEA189"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M10.2 4.6v3.4c0 2.2 1.8 4 4 4h4.6c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4.6c-2.2 0-4 1.8-4 4v3.8"
        stroke="#D07F66"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeDasharray="0.4 3.4"
        fill="none"
      />
    </>
  ),
};

const ROW_Y = [45, 120, 195, 270, 345, 420];
const BADGE_X = 248;
const BADGE_R = 22;
const RAIL_X = 208;
const TEXT_X = 280;

export default function BodyDiagram({ findings, accent }: { findings: string; accent: string }) {
  const matched = new Map(matchBodyPoints(findings).map((m) => [m.point.key, m.text]));

  return (
    <svg viewBox="0 0 440 480" className="h-auto w-full" aria-label="신체 부위별 검진소견">
      <defs>
        <linearGradient id="bd-body" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#a8f0f2" />
          <stop offset="35%" stopColor="#5fd3e4" />
          <stop offset="75%" stopColor="#2fa5c8" />
          <stop offset="100%" stopColor="#1c7ba3" />
        </linearGradient>
        <radialGradient id="bd-glow" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.17" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bd-sheen" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="bd-dim">
          <feColorMatrix type="saturate" values="0.12" />
        </filter>
      </defs>

      {/* 은은한 후광 */}
      <ellipse cx="100" cy="235" rx="118" ry="228" fill="url(#bd-glow)" />

      {/* 인체 — 좌우 대칭으로 두 번 그린다 */}
      <g>
        <ellipse cx="100" cy="42" rx="25" ry="30" fill="url(#bd-body)" />
        <path d={BODY_HALF} fill="url(#bd-body)" />
        <path d={BODY_HALF} fill="url(#bd-body)" transform="translate(200,0) scale(-1,1)" />
        {/* 왼쪽 면 광택 — 입체감 */}
        <ellipse cx="90" cy="36" rx="14" ry="19" fill="url(#bd-sheen)" />
        <path d={BODY_HALF} fill="url(#bd-sheen)" />
        {/* 근육 결 */}
        <g stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1" fill="none" strokeLinecap="round">
          <path d="M100,101 L100,246" strokeOpacity="0.16" />
          {BODY_LINES.map((d) => (
            <path key={d} d={d} />
          ))}
          {BODY_LINES.map((d) => (
            <path key={`m-${d}`} d={d} transform="translate(200,0) scale(-1,1)" />
          ))}
        </g>
      </g>

      {/* 연결선 — 해당 소견이 있는 부위만 */}
      {BODY_POINTS.map((p, i) =>
        matched.has(p.key) ? (
          <path
            key={`line-${p.key}`}
            d={`M${p.x},${p.y} C${RAIL_X},${p.y} ${RAIL_X},${ROW_Y[i]} ${BADGE_X - BADGE_R - 4},${ROW_Y[i]}`}
            fill="none"
            stroke={accent}
            strokeWidth={1.4}
            strokeDasharray="4 4"
            opacity={0.8}
          />
        ) : null,
      )}

      {/* 부위 지점 */}
      {BODY_POINTS.map((p) => {
        const on = matched.has(p.key);
        return on ? (
          <g key={`dot-${p.key}`}>
            <circle cx={p.x} cy={p.y} r={12} fill={accent} opacity={0.22} />
            <circle cx={p.x} cy={p.y} r={6} fill={accent} stroke="#08111f" strokeWidth={2} />
          </g>
        ) : (
          <circle key={`dot-${p.key}`} cx={p.x} cy={p.y} r={3.6} fill="#0b2b3d" opacity={0.4} />
        );
      })}

      {/* 오른쪽 목록 — 6개 부위를 항상 보여 주고, 해당 부위만 강조한다 */}
      {BODY_POINTS.map((p, i) => {
        const text = matched.get(p.key);
        const on = !!text;
        const y = ROW_Y[i];
        const detail = text ? (text.length > 12 ? `${text.slice(0, 12)}…` : text) : '특이사항 없음';
        return (
          <g key={`row-${p.key}`}>
            {on && <circle cx={BADGE_X} cy={y} r={BADGE_R + 5} fill={accent} opacity={0.18} />}
            <circle
              cx={BADGE_X}
              cy={y}
              r={BADGE_R}
              fill={on ? '#f2f6fc' : '#141d31'}
              stroke={on ? accent : '#2b3a5c'}
              strokeWidth={on ? 2.4 : 1.2}
            />
            <g
              transform={`translate(${BADGE_X - 15}, ${y - 15}) scale(0.9375)`}
              filter={on ? undefined : 'url(#bd-dim)'}
              opacity={on ? 1 : 0.5}
            >
              {ORGAN[p.key]}
            </g>
            <text x={TEXT_X} y={y - 3} style={{ fontSize: 14, fontWeight: 800 }} fill={on ? '#e7ecf9' : '#6f7f9f'}>
              {p.label}
            </text>
            <text x={TEXT_X} y={y + 15} style={{ fontSize: 12 }} fill={on ? '#a9b6d4' : '#4d5c7a'}>
              {detail}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
