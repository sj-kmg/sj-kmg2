'use client';

import { BODY_POINTS, matchBodyPoints } from '@/lib/healthFollowup';

/**
 * 유소견자 신체도 — 마네킹풍 인체(이목구비·손가락·발가락 포함)에 검진소견 부위를
 * 표시하고, 오른쪽에 장기 그림·부위명·소견을 줄로 잇는다.
 *
 * 좌표계: 인체는 중심선 x=100 기준 좌우 대칭이라 왼쪽 절반만 그리고 transform으로
 * 뒤집어 붙인다. 색 그라데이션은 userSpaceOnUse라 몸·손·발이 하나로 이어져 보인다.
 */

/** 몸통 왼쪽 절반 — 목→어깨→팔(손목까지)→몸통→다리(발목까지), 중심선으로 닫는다 */
const BODY_HALF =
  'M100,68 L87,70 C87,78 86,86 81,91 C69,95 54,100 43,110 C34,116 28,125 27,136 ' +
  'C24,152 21,166 19,178 C16,194 13,212 11,228 C10,235 13,240 18,240 ' +
  'C23,240 27,238 29,235 C30,231 30,228 31,224 C33,208 37,190 42,172 ' +
  'C46,154 49,136 52,124 C53,118 55,115 57,113 C59,127 60,141 61,155 ' +
  'C62,169 63,181 64,193 C65,201 66,209 66,217 C65,229 61,239 58,249 ' +
  'C58,269 59,291 60,311 C61,325 62,335 63,345 C64,367 65,393 66,413 ' +
  'C66,423 67,431 68,437 C68,443 72,446 77,446 C82,446 85,443 85,437 ' +
  'C85,415 86,391 87,367 C88,343 90,315 93,288 C95,270 97,258 100,254 Z';

/** 왼손 — 손바닥 + 네 손가락 + 엄지 */
function Hand({ fill }: { fill: string }) {
  const fingers = [
    { x: 7.5, top: 246, bottom: 266 },
    { x: 13.6, top: 244, bottom: 271 },
    { x: 19.7, top: 244, bottom: 274 },
    { x: 25.8, top: 246, bottom: 269 },
  ];
  return (
    <g fill={fill}>
      <rect x="7" y="228" width="25" height="26" rx="9" />
      {fingers.map((f) => (
        <rect key={f.x} x={f.x} y={f.top} width="5.3" height={f.bottom - f.top} rx="2.6" />
      ))}
      <ellipse cx="34" cy="243" rx="4.6" ry="8.6" transform="rotate(25 34 243)" />
    </g>
  );
}

/** 왼발 — 발등 + 다섯 발가락 (엄지가 안쪽) */
function Foot({ fill }: { fill: string }) {
  const toes = [
    { cx: 85, cy: 452, rx: 4.2, ry: 3.8 },
    { cx: 78, cy: 454, rx: 3.5, ry: 3.3 },
    { cx: 72, cy: 454, rx: 3.1, ry: 3 },
    { cx: 67, cy: 453, rx: 2.8, ry: 2.7 },
    { cx: 63, cy: 452, rx: 2.4, ry: 2.4 },
  ];
  return (
    <g fill={fill}>
      <path d="M67,430 C64,438 62,445 63,449 C64,453 70,454 76,454 C83,454 88,453 88,449 C88,444 87,437 85,430 Z" />
      {toes.map((t) => (
        <ellipse key={t.cx} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} />
      ))}
    </g>
  );
}

/** 근육 결 — 마네킹의 굴곡을 얇은 선으로 (왼쪽 절반, 대칭 복제) */
const BODY_LINES = [
  'M81,94 C88,100 95,102 100,102',
  'M60,118 C70,135 88,141 100,139',
  'M100,161 L84,160',
  'M100,181 L84,180',
  'M100,201 L85,200',
  'M35,132 C31,158 26,186 22,212',
  'M63,352 C71,357 81,357 87,352',
  'M74,272 C72,298 71,322 70,344',
  'M69,372 C68,394 68,414 68,430',
];

/** 얼굴 — 왼쪽 절반만 정의하고 대칭 복제한다 (코·입 가운데는 따로) */
const FACE_HALF = {
  brow: 'M83,35 C87,31.5 93,31.5 96.5,34',
  eye: 'M84.5,42.5 C88,38.8 94,38.8 97,42.5 C94,45.6 88,45.6 84.5,42.5 Z',
  pupilX: 90.7,
  nose: 'M100,58 C96.8,59.4 94.6,58.2 94.6,55.6',
  mouth: 'M100,67.5 C97,68.2 93.8,67.4 91.6,65.6',
  earCx: 74.2,
};

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

const ROW_Y = [45, 120, 195, 270, 345, 420];
const BADGE_X = 248;
const BADGE_R = 22;
const RAIL_X = 208;
const TEXT_X = 280;
const MIRROR = 'translate(200,0) scale(-1,1)';

export default function BodyDiagram({ findings, accent }: { findings: string; accent: string }) {
  const matched = new Map(matchBodyPoints(findings).map((m) => [m.point.key, m.text]));

  return (
    <svg viewBox="0 0 440 480" className="h-auto w-full" aria-label="신체 부위별 검진소견">
      <defs>
        {/* userSpaceOnUse — 몸·손·발이 같은 색 흐름으로 이어지게 한다 */}
        <linearGradient id="bd-body" gradientUnits="userSpaceOnUse" x1="35" y1="10" x2="165" y2="460">
          <stop offset="0%" stopColor="#79b6c6" />
          <stop offset="32%" stopColor="#4a8ba1" />
          <stop offset="70%" stopColor="#2f6a80" />
          <stop offset="100%" stopColor="#1f4a5e" />
        </linearGradient>
        <linearGradient id="bd-sheen" gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="115" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="bd-glow" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <filter id="bd-dim">
          <feColorMatrix type="saturate" values="0.12" />
        </filter>
      </defs>

      <ellipse cx="100" cy="235" rx="118" ry="228" fill="url(#bd-glow)" />

      {/* ── 인체 ─────────────────────────────────────────── */}
      <g>
        <ellipse cx="100" cy="44" rx="27" ry="32" fill="url(#bd-body)" />
        <ellipse cx={FACE_HALF.earCx} cy="46" rx="3.6" ry="7" fill="url(#bd-body)" />
        <ellipse cx={200 - FACE_HALF.earCx} cy="46" rx="3.6" ry="7" fill="url(#bd-body)" />
        <path d={BODY_HALF} fill="url(#bd-body)" />
        <path d={BODY_HALF} fill="url(#bd-body)" transform={MIRROR} />
        <Hand fill="url(#bd-body)" />
        <g transform={MIRROR}>
          <Hand fill="url(#bd-body)" />
        </g>
        <Foot fill="url(#bd-body)" />
        <g transform={MIRROR}>
          <Foot fill="url(#bd-body)" />
        </g>

        {/* 광택 */}
        <ellipse cx="90" cy="38" rx="15" ry="20" fill="url(#bd-sheen)" />
        <path d={BODY_HALF} fill="url(#bd-sheen)" />

        {/* 근육 결 */}
        <g stroke="#d8f3fb" strokeOpacity="0.17" strokeWidth="1" fill="none" strokeLinecap="round">
          <path d="M100,102 L100,250" strokeOpacity="0.13" />
          {BODY_LINES.map((d) => (
            <path key={d} d={d} />
          ))}
          {BODY_LINES.map((d) => (
            <path key={`m-${d}`} d={d} transform={MIRROR} />
          ))}
        </g>

        {/* 이목구비 */}
        <g>
          <path d={FACE_HALF.eye} fill="#12303c" opacity="0.85" />
          <path d={FACE_HALF.eye} fill="#12303c" opacity="0.85" transform={MIRROR} />
          <circle cx={FACE_HALF.pupilX} cy="42.5" r="2" fill="#e8f6fb" opacity="0.75" />
          <circle cx={200 - FACE_HALF.pupilX} cy="42.5" r="2" fill="#e8f6fb" opacity="0.75" />
          <g stroke="#12303c" strokeOpacity="0.6" fill="none" strokeLinecap="round">
            <path d={FACE_HALF.brow} strokeWidth="2.6" />
            <path d={FACE_HALF.brow} strokeWidth="2.6" transform={MIRROR} />
            <path d="M100,46 L100,58" strokeWidth="1.4" strokeOpacity="0.4" />
            <path d={FACE_HALF.nose} strokeWidth="1.4" />
            <path d={FACE_HALF.nose} strokeWidth="1.4" transform={MIRROR} />
            <path d={FACE_HALF.mouth} strokeWidth="1.8" />
            <path d={FACE_HALF.mouth} strokeWidth="1.8" transform={MIRROR} />
          </g>
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
            <circle cx={p.x} cy={p.y} r={12} fill={accent} opacity={0.24} />
            <circle cx={p.x} cy={p.y} r={6} fill={accent} stroke="#08111f" strokeWidth={2} />
          </g>
        ) : (
          <circle key={`dot-${p.key}`} cx={p.x} cy={p.y} r={3.6} fill="#0a2230" opacity={0.45} />
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
