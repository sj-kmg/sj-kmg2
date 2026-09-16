'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * 화면 하나가 잘못돼도 앱 전체가 죽지 않게 막아 주는 울타리.
 *
 * 지금까지는 어느 화면에서 오류가 나면 앱이 통째로 내려앉아 브라우저가
 * "This page couldn't load"를 띄웠다. 그러면 무엇이 잘못됐는지 알 길이 없고,
 * 사용자는 아무것도 못 본다.
 *
 * 이제는 그 화면만 대신 안내를 보여 주고 나머지(메뉴·다른 화면)는 그대로 쓴다.
 * 그리고 **무엇이 터졌는지 기기에 남긴다** — 다음에 같은 일이 나면 그 기록을 보고
 * 원인을 바로 짚을 수 있다.
 */

/** 오류 내용을 브라우저 저장소에 남긴다 (최근 20건) */
export function recordScreenError(where: string, message: string, stack?: string): void {
  const entry = {
    at: new Date().toISOString(),
    where,
    message: String(message).slice(0, 400),
    stack: String(stack ?? '').split('\n').slice(0, 6).join(' | ').slice(0, 700),
  };
  try {
    const key = 'sj-screen-errors';
    const prev = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[];
    localStorage.setItem(key, JSON.stringify([...prev, entry].slice(-20)));
  } catch {
    // 저장소를 못 쓰는 상황이면 기록은 포기한다
  }
  // 캐시에도 한 벌 남긴다 — 저장소가 지워져도 남아 있게
  try {
    void caches.open('sj-v2-shell').then(async (c) => {
      let list: unknown[] = [];
      const prev = await c.match('/__errors');
      if (prev) list = (await prev.json().catch(() => [])) as unknown[];
      await c.put(
        '/__errors',
        new Response(JSON.stringify([...list, entry].slice(-20)), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
  } catch {
    // 캐시를 못 쓰면 위의 저장소 기록만으로 충분하다
  }
}

interface Props {
  /** 어느 화면인지 — 기록에 남는다 */
  view: string;
  children: ReactNode;
}

interface State {
  message: string | null;
}

export default class ScreenGuard extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || '알 수 없는 오류' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    recordScreenError(this.props.view, error.message, `${error.stack ?? ''}\n${info.componentStack ?? ''}`);
  }

  componentDidUpdate(prev: Props): void {
    // 다른 화면으로 옮기면 다시 정상으로 돌아간다
    if (prev.view !== this.props.view && this.state.message) this.setState({ message: null });
  }

  render(): ReactNode {
    if (this.state.message === null) return this.props.children;
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
        <p className="text-sm font-bold text-amber-900">이 화면을 여는 중 문제가 생겼습니다</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-800">
          다른 메뉴는 그대로 쓰실 수 있습니다.
          <br />
          아래 버튼으로 다시 시도해 보시고, 계속 같으면 알려 주세요.
        </p>
        <p className="mt-3 font-mono text-[11px] break-all text-amber-700">{this.state.message}</p>
        <button
          onClick={() => this.setState({ message: null })}
          className="mt-4 rounded-lg bg-[#1f3864] px-4 py-2 text-xs font-bold text-white"
        >
          다시 시도
        </button>
      </div>
    );
  }
}
