'use client';

import { BODY_POINTS, matchBodyPoints } from '@/lib/healthFollowup';

/**
 * 유소견자 신체도 — 이목구비 없는 인체 모형(참고 이미지의 와이어프레임 메쉬 방식)에
 * 검진소견 부위를 표시하고, 오른쪽에 장기 그림·부위명·소견을 줄로 잇는다.
 *
 * 좌표계: 인체는 중심선 x=100 기준 좌우 대칭이라 왼쪽 절반만 그리고 transform으로
 * 뒤집어 붙인다. 손·발은 손가락·발가락 없이 둥근 덩어리로 실루엣에 이어 그린다.
 */

/**
 * 몸통 왼쪽 절반 — 목→어깨→겨드랑이→옆구리→다리→발, 중심선으로 닫는다.
 * 팔은 일부러 따로 그린다 (한 덩어리로 그리면 겨드랑이 틈이 메워져 붙어 보인다).
 */
const TORSO_HALF =
  'M100,64 L91,66 C91,74 90,80 86,86 C74,90 62,94 52,101 C51,106 51,112 53,118 ' +
  'C56,120 58,121 60,124 C60,136 59,146 58,156 C58,170 60,182 62,194 ' +
  'C64,202 66,210 66,218 C65,230 60,240 58,250 C58,270 59,292 60,312 ' +
  'C61,326 62,336 63,346 C64,368 65,394 66,414 C66,424 67,432 68,438 ' +
  'C64,444 62,451 64,455 C67,459 82,459 86,455 C89,451 88,444 86,438 ' +
  'C87,416 88,392 89,368 C90,344 93,316 96,288 C97,272 98,260 100,252 Z';

/** 왼팔 — 삼각근에서 손까지. 몸통과 겹치지 않게 띄워 겨드랑이 틈이 보이도록 한다 */
const ARM_HALF =
  'M52,102 C42,106 32,110 26,118 C24,128 23,138 22,148 C20,162 18,176 17,188 ' +
  'C15,205 12,222 10,238 C8,248 9,260 14,266 C19,271 28,270 31,263 ' +
  'C33,256 33,248 32,240 C34,224 36,208 39,192 C41,176 43,160 45,146 ' +
  'C47,134 49,126 50,120 C51,113 51,107 52,102 Z';

const MIRROR = 'translate(200,0) scale(-1,1)';

/** 장기 그림 — 32×32 기준, 해부 일러스트 색상 */
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

/** 세로 메쉬 — 중심에서 멀수록 바깥으로 휘어 몸의 굴곡을 따라간다 */
const MESH_V = Array.from({ length: 19 }, (_, i) => {
  const x = 12 + i * 10;
  const bow = (x - 100) * 0.14;
  return `M${x},0 Q${(x + bow).toFixed(1)},240 ${x},470`;
});
/** 가로 메쉬 — 원통을 두른 것처럼 아래로 처지는 링 */
const MESH_H = Array.from({ length: 30 }, (_, i) => {
  const y = 6 + i * 16;
  return `M0,${y} Q100,${y + 7} 200,${y}`;
});

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
        <linearGradient id="bd-body" gradientUnits="userSpaceOnUse" x1="40" y1="10" x2="160" y2="465">
          <stop offset="0%" stopColor="#a6e2e6" />
          <stop offset="45%" stopColor="#7fc7d2" />
          <stop offset="100%" stopColor="#5aa3b4" />
        </linearGradient>
        <radialGradient id="bd-glow" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <filter id="bd-dim">
          <feColorMatrix type="saturate" values="0.12" />
        </filter>
        {/* 메쉬를 몸 안쪽에만 그리기 위한 클립 */}
        <clipPath id="bd-clip">
          <ellipse cx="100" cy="40" rx="25" ry="29" />
          <path d={TORSO_HALF} />
          <path d={TORSO_HALF} transform={MIRROR} />
          <path d={ARM_HALF} />
          <path d={ARM_HALF} transform={MIRROR} />
        </clipPath>
      </defs>

      <ellipse cx="100" cy="235" rx="96" ry="215" fill="url(#bd-glow)" />

      {/* ── 인체 ─────────────────────────────────────────── */}
      <g>
        <ellipse cx="100" cy="40" rx="25" ry="29" fill="url(#bd-body)" />
        <path d={TORSO_HALF} fill="url(#bd-body)" />
        <path d={TORSO_HALF} fill="url(#bd-body)" transform={MIRROR} />
        <path d={ARM_HALF} fill="url(#bd-body)" />
        <path d={ARM_HALF} fill="url(#bd-body)" transform={MIRROR} />

        {/* 와이어프레임 메쉬 */}
        <g clipPath="url(#bd-clip)" stroke="#eafcff" fill="none" strokeWidth="0.7" opacity="0.3">
          {MESH_V.map((d) => (
            <path key={d} d={d} />
          ))}
          {MESH_H.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* 윤곽 — 실루엣을 또렷하게 */}
        <g fill="none" stroke="#dcf8fd" strokeOpacity="0.5" strokeWidth="1.2">
          <ellipse cx="100" cy="40" rx="25" ry="29" />
          <path d={TORSO_HALF} />
          <path d={TORSO_HALF} transform={MIRROR} />
          <path d={ARM_HALF} />
          <path d={ARM_HALF} transform={MIRROR} />
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
            opacity={0.85}
          />
        ) : null,
      )}

      {/* 부위 지점 */}
      {BODY_POINTS.map((p) => {
        const on = matched.has(p.key);
        return on ? (
          <g key={`dot-${p.key}`}>
            <circle cx={p.x} cy={p.y} r={12} fill={accent} opacity={0.26} />
            <circle cx={p.x} cy={p.y} r={6} fill={accent} stroke="#0d3b47" strokeWidth={2} />
          </g>
        ) : (
          <circle key={`dot-${p.key}`} cx={p.x} cy={p.y} r={2.8} fill="#2f7183" opacity={0.35} />
        );
      })}

      {/* 오른쪽 목록 */}
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
