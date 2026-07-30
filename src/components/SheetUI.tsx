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
 */

/** 입력 칸 공통 — 내용이 잘리지 않도록 좌우 여백을 최소화하고 폭을 꽉 채운다 */
export const CELL =
  'w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-[#1f3864] focus:outline-none';

/** 표 머리글 공통 — 제목이 두 줄로 접히지 않게 한다 */
export const TH = 'px-2 py-2 font-semibold whitespace-nowrap';

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
