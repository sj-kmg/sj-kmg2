/**
 * 첨부서류의 유효기간 관리 — 차량등록증(검사유효기간)·보험증권(보험기간).
 *
 * 두 서류는 기간이 끝나면 새로 발급받아 **첨부파일을 교체**해야 한다.
 * 기간이 지난 서류를 그대로 두면 현장에서 제시했을 때 무효라, 지나기 전에 알려 준다.
 *
 * 만료일을 모르는 경우(스캔 서류라 글자를 읽어 낼 수 없는 경우 등)는
 * 넘겨짚지 않고 '확인 필요'로 남긴다 — 틀린 날짜를 맞다고 보여 주는 쪽이 더 위험하다.
 */
import { daysUntil } from './education';

/** 만료가 다가오면 알리기 시작하는 시점 — 검사·보험 모두 한 달이면 준비에 충분하다 */
export const CERT_NOTICE_DAYS = 30;

export type CertKind = 'inspection' | 'insurance';

export const CERT_LABEL: Record<CertKind, string> = {
  inspection: '검사유효기간',
  insurance: '보험기간',
};

/** 어느 첨부를 교체해야 하는지 */
export const CERT_FILE_LABEL: Record<CertKind, string> = {
  inspection: '차량등록증',
  insurance: '보험증권',
};

export type CertLevel = 'unknown' | 'expired' | 'soon' | 'ok';

export interface CertStatus {
  kind: CertKind;
  /** 만료일 (YYYY-MM-DD) — 모르면 '' */
  until: string;
  /** 만료까지 남은 날 — 만료일을 모르면 NaN */
  days: number;
  level: CertLevel;
  /** 배지에 쓰는 짧은 말 — 여유가 있으면 '' (배지를 달지 않는다) */
  badge: string;
  /** 배지 색 */
  badgeClass: string;
  /** 옆에 덧붙이는 설명 */
  note: string;
}

const OK_CLASS = '';
const STYLE: Record<Exclude<CertLevel, 'ok'>, string> = {
  expired: 'bg-red-600 text-white',
  soon: 'bg-orange-100 text-orange-800',
  unknown: 'bg-slate-100 text-slate-500',
};

/**
 * 서류 한 건의 상태.
 * @param until 만료일 (YYYY-MM-DD). 비어 있으면 '확인 필요'
 */
export function certStatus(kind: CertKind, until: string | undefined, today = new Date()): CertStatus {
  const date = (until ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      kind,
      until: '',
      days: NaN,
      level: 'unknown',
      badge: '만료일 확인',
      badgeClass: STYLE.unknown,
      note: `${CERT_LABEL[kind]}을 입력해 주세요`,
    };
  }

  const days = daysUntil(date, today);
  if (days < 0) {
    return {
      kind,
      until: date,
      days,
      level: 'expired',
      badge: '교체 필요',
      badgeClass: STYLE.expired,
      note: `${-days}일 지남 · 새 ${CERT_FILE_LABEL[kind]}으로 교체하세요`,
    };
  }
  if (days <= CERT_NOTICE_DAYS) {
    return {
      kind,
      until: date,
      days,
      level: 'soon',
      badge: days === 0 ? '오늘 만료' : `D-${days}`,
      badgeClass: STYLE.soon,
      note: `${CERT_LABEL[kind]} 곧 만료 · 교체 준비하세요`,
    };
  }
  return { kind, until: date, days, level: 'ok', badge: '', badgeClass: OK_CLASS, note: '' };
}

/** 급한 순 — 지난 것 > 임박 > 모름 > 여유 */
const ORDER: Record<CertLevel, number> = { expired: 0, soon: 1, unknown: 2, ok: 3 };

/** 두 서류 중 가장 급한 것 — 목록에 배지 하나만 달 때 쓴다 */
export function worstStatus(list: CertStatus[]): CertStatus | null {
  const sorted = [...list].sort((a, b) => {
    const d = ORDER[a.level] - ORDER[b.level];
    if (d !== 0) return d;
    // 같은 단계면 날짜가 급한 쪽
    if (Number.isNaN(a.days)) return 0;
    return a.days - b.days;
  });
  const top = sorted[0];
  return top && top.level !== 'ok' ? top : null;
}

/** 화면 위쪽 요약용 집계 */
export interface CertSummary {
  expired: number;
  soon: number;
  unknown: number;
}

export function summarize(all: CertStatus[]): CertSummary {
  return {
    expired: all.filter((s) => s.level === 'expired').length,
    soon: all.filter((s) => s.level === 'soon').length,
    unknown: all.filter((s) => s.level === 'unknown').length,
  };
}
