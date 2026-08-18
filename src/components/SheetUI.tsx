'use client';

/**
 * 시트형 화면(대장·명부) 공용 UI 조각.
 *
 * **표 너비 원칙** — 글자 크기는 줄이지 않고 열 너비를 넉넉히 잡아 내용이 잘리지 않게 한다.
 * 표는 `overflow-x-auto` 안에 두고 `min-w-[…]`로 전체 너비를 확보하면, 화면이 좁을 때는
 * 가로 스크롤이 생기고 넓을 때는 꽉 차게 보인다. 새 표를 만들 때도 같은 기준을 따른다.
 *   - 날짜(YYYY-MM-DD) 칸: w-40
 *   - 이름·번호: w-32 이상
 *   - 모델·제조사처럼 긴 값: w-48 이상
 *   - 표 전체: 열 너비 합계보다 크게 min-w 지정
 *
 * **화면 폭** — 각 화면의 바깥 상자는 `max-w-*`로 좁히지 말고 `w-full`을 쓴다.
 * 내용이 많든 적든 표가 화면 가로를 꽉 채우도록 한다는 것이 사용자 요구사항이다.
 * (`<main>`에는 폭 제한이 없으므로 화면 컴포넌트에서 제한하지 않으면 전체 폭을 쓴다)
 *
 * **고정 열 원칙** — 표를 옆으로 밀어서 봐야 할 만큼 넓다면, 어느 행인지 식별할 수 있는
 * 첫 번째 열(이름·차량번호·관리번호 등)은 반드시 고정한다. 옆으로 드래그하다 보면 지금
 * 보고 있는 값이 누구/무엇 것인지 알 수 없어 처음으로 되돌아가야 하는 문제를 없애기 위함
 * (사용자 요구사항 — 기존 표는 물론 앞으로 새로 만드는 모든 표에도 적용한다).
 * 표 머리글의 식별 칸에는 `TH_STICKY`, 본문 행의 식별 칸에는 `TD_STICKY`를 더해 쓴다.
 *   `<th className={`${TH} ${TH_STICKY} w-36`}>차량번호</th>`
 *   `<td className={`${TD_STICKY} px-1.5 py-1.5`}>...</td>`
 * 그 행이 상태별로 다른 배경(미실시 강조 등)을 쓴다면 `TD_STICKY` 대신 위치만 잡아 주는
 * `TD_STICKY_POS`에 그 배경 클래스를 직접 붙인다 — `bg-white`는 `!important`라 다른 배경
 * 클래스를 함께 써도 덮어써지므로, 배경이 다른 행에는 반드시 `TD_STICKY_POS`를 쓴다.
 *   `<td className={`${TD_STICKY_POS} ${r.status === '미실시' ? 'bg-amber-50/40' : 'bg-white'} px-1.5 py-1.5`}>`
 */

/** 입력 칸 공통 — 내용이 잘리지 않도록 좌우 여백을 최소화하고 폭을 꽉 채운다 */
export const CELL =
  'w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none';

/** 표 머리글 공통 — 제목이 두 줄로 접히지 않게 한다 */
export const TH = 'px-2 py-2 font-semibold whitespace-nowrap';

/** 고정 열 — 표 머리글의 식별 칸 (TH와 함께 쓴다) */
export const TH_STICKY = 'sticky left-0 z-20 bg-slate-50 shadow-[2px_0_0_0_rgba(15,30,58,0.08)]';

/** 고정 열 — 표 본문의 식별 칸 (배경이 늘 흰색/기본일 때) */
export const TD_STICKY = 'sticky left-0 z-10 bg-white shadow-[2px_0_0_0_rgba(15,30,58,0.08)]';

/** 고정 열 — 위치만 지정 (행마다 배경이 달라지는 표에서 배경 클래스를 직접 붙일 때 쓴다) */
export const TD_STICKY_POS = 'sticky left-0 z-10 shadow-[2px_0_0_0_rgba(15,30,58,0.08)]';

/** 자동저장 상태 + 행 추가 + 되돌리기 */
export function SheetToolbar({
  addLabel,
  onAdd,
  onUndo,
  canUndo,
  save,
}: {
  addLabel: string;
  onAdd?: () => void;
  onUndo: () => void;
  canUndo: boolean;
  save: { text: string; className: string } | null;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      {onAdd && (
        <button
          onClick={onAdd}
          className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864]"
        >
          {addLabel}
        </button>
      )}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="직전 변경을 취소합니다 (삭제한 행도 되살아납니다)"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1f3864] hover:text-[#1f3864] disabled:opacity-40"
      >
        ↩ 되돌리기
      </button>
      {save && <span className={`text-xs ${save.className}`}>{save.text}</span>}
    </div>
  );
}
