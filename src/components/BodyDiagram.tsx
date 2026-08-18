'use client';

import { BODY_POINTS, matchBodyPoints } from '@/lib/healthFollowup';

/**
 * 유소견자 신체도 — 인체 실루엣에 검진소견 부위를 표시하고,
 * 오른쪽에 장기 아이콘·부위명·소견을 줄로 잇는다.
 *
 * 좌표계: 인체는 중심선 x=70을 기준으로 좌우 대칭이라 왼쪽 절반만 그리고
 * transform으로 뒤집어 붙인다 (경계가 어긋나지 않고 파일도 짧아진다).
 */

/** 인체 왼쪽 절반 — 목→어깨→팔→몸통→다리, 중심선(x=70)으로 닫는다 */
const BODY_HALF =
  'M70,56 L61,57 C61,64 60,69 57,72 C49,75 41,79 35,85 C30,90 27,97 26,105 ' +
  'C24,120 22,140 20,158 C18,175 16,190 15,203 C14,212 13,220 14,226 ' +
  'C15,233 22,234 24,227 C27,214 30,198 33,182 C36,166 39,148 41,132 ' +
  'C42,124 43,117 45,112 C46,124 47,136 48,148 C48,156 47,164 46,172 ' +
  'C44,184 43,196 43,208 C43,222 44,240 45,258 C46,278 47,300 48,320 ' +
  'C49,342 50,368 51,392 C51,404 52,416 53,426 C53,433 55,437 59,437 ' +
  'C64,437 66,433 66,427 C67,411 67,391 67,369 C67,347 67,327 67,309 ' +
  'C67,297 68,291 70,287 Z';

/** 장기 아이콘 — 24×24 기준. fill은 면, stroke는 결(무늬)을 그린다 */
const ORGAN: Record<string, { fill?: string; stroke?: string }> = {
  brain: {
    fill:
      'M12 3.6c-1.9 0-3.6.9-4.6 2.3-1.9.2-3.4 1.8-3.4 3.8 0 .6.1 1.1.3 1.6-.7.7-1.1 1.6-1.1 2.6 0 1.6 1 3 2.5 3.5.3 1.9 1.9 3.3 3.9 3.3.9 0 1.7-.3 2.4-.8.7.5 1.5.8 2.4.8 2 0 3.6-1.4 3.9-3.3 1.5-.5 2.5-1.9 2.5-3.5 0-1-.4-1.9-1.1-2.6.2-.5.3-1 .3-1.6 0-2-1.5-3.6-3.4-3.8-1-1.4-2.7-2.3-4.6-2.3z',
    stroke: 'M12 5.6v13M9.2 8.6c-1.4.7-1.4 2.7 0 3.4M14.8 8.6c1.4.7 1.4 2.7 0 3.4M8.6 14.4c1.2.6 2.4.6 3.4 0M15.4 14.4c-1.2.6-2.4.6-3.4 0',
  },
  lungs: {
    fill:
      'M10.9 9.8c-.9-.9-2.1-1.3-3.3-1.1-2 .3-3.4 2.2-3.6 4.3l-.4 3.9c-.2 2.1 1.3 3.9 3.3 3.9 1.9 0 3.5-1.5 3.7-3.4l.5-5.3c.1-.9-.1-1.7-.2-2.3z' +
      'M13.1 9.8c.9-.9 2.1-1.3 3.3-1.1 2 .3 3.4 2.2 3.6 4.3l.4 3.9c.2 2.1-1.3 3.9-3.3 3.9-1.9 0-3.5-1.5-3.7-3.4l-.5-5.3c-.1-.9.1-1.7.2-2.3z',
    stroke: 'M12 3.2v6.6M12 6.2h-2.2M12 6.2h2.2',
  },
  heart: {
    fill:
      'M12 20.6l-1.5-1.4C5.6 14.9 2.5 12.1 2.5 8.6 2.5 5.7 4.8 3.4 7.7 3.4c1.7 0 3.3.8 4.3 2.1 1-1.3 2.6-2.1 4.3-2.1 2.9 0 5.2 2.3 5.2 5.2 0 3.5-3.1 6.3-8 10.6l-1.5.8z',
  },
  liver: {
    fill:
      'M3.6 8.9c3.4-2.1 9-2.9 14.2-1.8 2.7.6 4.2 2.4 3.7 5-.6 3.3-3.9 6.5-8.4 7-4.4.5-8.4-1.7-9.4-5-.5-1.7-.5-3.4-.1-5.2z',
    stroke: 'M11.6 7.3l1.1 4.6',
  },
  stomach: {
    fill:
      'M8.4 3.2c-.8 0-1.4.6-1.4 1.4v4.9c0 4.6 2.3 8 6.1 8.8 3.3.7 6.1-1.5 6.1-4.7 0-2.9-2.2-5-5.1-5-.8 0-1.4.6-1.4 1.4s.6 1.4 1.4 1.4c1.3 0 2.3.9 2.3 2.2 0 1.5-1.3 2.4-2.8 2.1-2.4-.5-3.8-2.8-3.8-6V4.6c0-.8-.6-1.4-1.4-1.4z',
  },
  gut: {
    stroke:
      'M7.5 3.8v2.4c0 1.6 1.3 2.9 2.9 2.9h3.2c1.6 0 2.9 1.3 2.9 2.9s-1.3 2.9-2.9 2.9h-3.2c-1.6 0-2.9 1.3-2.9 2.9v2.4',
  },
};

const ROW_Y = [48, 118, 188, 258, 328, 398];
const BADGE_X = 186;
const RAIL_X = 145;
const TEXT_X = 214;

export default function BodyDiagram({ findings, accent }: { findings: string; accent: string }) {
  const matched = new Map(matchBodyPoints(findings).map((m) => [m.point.key, m.text]));

  return (
    <svg viewBox="0 0 380 470" className="h-auto w-full" aria-label="신체 부위별 검진소견">
      <defs>
        <linearGradient id="bd-body" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#5f8ad6" />
          <stop offset="45%" stopColor="#3a63a8" />
          <stop offset="100%" stopColor="#1d3560" />
        </linearGradient>
        <radialGradient id="bd-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bd-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 은은한 후광 */}
      <ellipse cx="70" cy="220" rx="105" ry="215" fill="url(#bd-glow)" />

      {/* 인체 — 좌우 대칭으로 두 번 그린다 */}
      <g>
        <ellipse cx="70" cy="38" rx="19.5" ry="23" fill="url(#bd-body)" />
        <path d={BODY_HALF} fill="url(#bd-body)" />
        <path d={BODY_HALF} fill="url(#bd-body)" transform="translate(140,0) scale(-1,1)" />
        {/* 왼쪽 면에만 얇은 광택 — 입체감 */}
        <ellipse cx="63" cy="34" rx="11" ry="15" fill="url(#bd-sheen)" />
        <path d={BODY_HALF} fill="url(#bd-sheen)" />
      </g>

      {/* 연결선 — 해당 소견이 있는 부위만 (아래 점·배지보다 먼저 그려 겹치지 않게) */}
      {BODY_POINTS.map((p, i) =>
        matched.has(p.key) ? (
          <path
            key={`line-${p.key}`}
            d={`M${p.x},${p.y} C${RAIL_X},${p.y} ${RAIL_X},${ROW_Y[i]} ${BADGE_X - 19},${ROW_Y[i]}`}
            fill="none"
            stroke={accent}
            strokeWidth={1.3}
            strokeDasharray="4 4"
            opacity={0.75}
          />
        ) : null,
      )}

      {/* 부위 지점 */}
      {BODY_POINTS.map((p) => {
        const on = matched.has(p.key);
        return on ? (
          <g key={`dot-${p.key}`}>
            <circle cx={p.x} cy={p.y} r={11} fill={accent} opacity={0.2} />
            <circle cx={p.x} cy={p.y} r={5.5} fill={accent} stroke="#0b1120" strokeWidth={1.8} />
          </g>
        ) : (
          <circle key={`dot-${p.key}`} cx={p.x} cy={p.y} r={3.4} fill="#93a6cc" opacity={0.55} />
        );
      })}

      {/* 오른쪽 목록 — 6개 부위를 항상 보여 주고, 해당 부위만 강조한다 */}
      {BODY_POINTS.map((p, i) => {
        const text = matched.get(p.key);
        const on = !!text;
        const y = ROW_Y[i];
        const icon = ORGAN[p.key];
        const detail = text ? (text.length > 13 ? `${text.slice(0, 13)}…` : text) : '특이사항 없음';
        return (
          <g key={`row-${p.key}`}>
            {on && <circle cx={BADGE_X} cy={y} r={23} fill={accent} opacity={0.16} />}
            <circle
              cx={BADGE_X}
              cy={y}
              r={19}
              fill={on ? accent : '#182238'}
              stroke={on ? 'transparent' : '#2b3a5c'}
              strokeWidth={1.2}
            />
            <g
              transform={`translate(${BADGE_X - 11.5}, ${y - 11.5}) scale(0.958)`}
              fill={on ? '#ffffff' : '#7285a8'}
              stroke={on ? '#ffffff' : '#7285a8'}
            >
              {icon?.fill && <path d={icon.fill} stroke="none" fillRule="evenodd" />}
              {icon?.stroke && (
                <path
                  d={icon.stroke}
                  fill="none"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={icon.fill ? 0.55 : 1}
                />
              )}
            </g>
            <text x={TEXT_X} y={y - 3} style={{ fontSize: 13.5, fontWeight: 800 }} fill={on ? '#e7ecf9' : '#6f7f9f'}>
              {p.label}
            </text>
            <text x={TEXT_X} y={y + 14} style={{ fontSize: 11.5 }} fill={on ? '#a9b6d4' : '#4d5c7a'}>
              {detail}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
