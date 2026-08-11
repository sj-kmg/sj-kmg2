/**
 * 미전송함 — 현장에서 신호가 끊겼을 때 기록을 잃지 않기 위한 대기열.
 *
 * 저장 요청이 네트워크 문제로 실패하면 여기에 쌓아 두고,
 * 인터넷이 돌아오면 자동으로 다시 보낸다.
 * (암호 오류·형식 오류처럼 다시 보내도 실패할 요청은 쌓지 않는다)
 */
import { SyncError, removeEntryRemote, saveEntryRemote, type LogType } from './sync';

const KEY = 'sj-outbox:v1';

export interface OutboxJob {
  /** 대기열 안에서의 식별자 */
  key: string;
  type: LogType;
  action: 'save' | 'remove';
  id: string;
  entry?: unknown;
  queuedAt: string;
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

function read(): OutboxJob[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OutboxJob[];
  } catch {
    return [];
  }
}

function write(jobs: OutboxJob[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch {
    // 저장 공간이 없으면 어쩔 수 없다
  }
  listeners.forEach((fn) => fn(jobs.length));
}

export function outboxCount(): number {
  return read().length;
}

/**
 * 아직 못 보낸 기록 목록 — 앱을 껐다 켜도 화면에서 사라지지 않도록
 * 서버 목록에 얹어서 보여 준다.
 */
export function pendingEntries<T>(type: LogType): T[] {
  return read()
    .filter((j) => j.type === type && j.action === 'save' && j.entry)
    .map((j) => j.entry as T);
}

/** 아직 못 보낸 삭제 요청의 기록 id — 화면에서도 미리 지워 둔다 */
export function pendingRemovals(type: LogType): string[] {
  return read().filter((j) => j.type === type && j.action === 'remove').map((j) => j.id);
}

export function onOutboxChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 다시 보내면 성공할 수 있는 실패인가?
 * 400(형식 오류)·401(암호 오류)·413(용량 초과)은 재시도해도 같은 결과라 대기열에 넣지 않는다.
 */
export function isRetriable(e: unknown): boolean {
  if (e instanceof SyncError) return e.status >= 500 || e.status === 0;
  return true; // fetch 자체 실패 = 네트워크 문제
}

/** 같은 기록에 대한 이전 대기 건은 덮어쓴다 (마지막 상태만 보내면 된다) */
export function enqueue(job: Omit<OutboxJob, 'key' | 'queuedAt'>): void {
  const key = `${job.type}|${job.id}`;
  const jobs = read().filter((j) => j.key !== key);
  jobs.push({ ...job, key, queuedAt: new Date().toISOString() });
  write(jobs);
}

let flushing = false;

/**
 * 대기열 전송 — 성공한 것만 지운다.
 * 네트워크가 아직 안 돌아왔으면 남겨 두고 다음 기회에 다시 시도한다.
 */
export async function flushOutbox(): Promise<{ sent: number; left: number }> {
  if (flushing) return { sent: 0, left: outboxCount() };
  flushing = true;
  try {
    let jobs = read();
    let sent = 0;
    for (const job of [...jobs]) {
      try {
        if (job.action === 'save') await saveEntryRemote(job.type, job.entry);
        else await removeEntryRemote(job.type, job.id);
        jobs = jobs.filter((j) => j.key !== job.key);
        write(jobs);
        sent++;
      } catch (e) {
        if (!isRetriable(e)) {
          // 다시 보내도 실패할 건은 대기열에서 빼고 넘어간다
          jobs = jobs.filter((j) => j.key !== job.key);
          write(jobs);
          continue;
        }
        break; // 네트워크가 아직 안 됨 — 나머지는 다음에
      }
    }
    return { sent, left: jobs.length };
  } finally {
    flushing = false;
  }
}

/** 인터넷 복귀·앱 복귀 시 자동 전송 */
export function startOutboxWatcher(): () => void {
  const run = () => void flushOutbox();
  window.addEventListener('online', run);
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(run, 60_000);
  run();
  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}
