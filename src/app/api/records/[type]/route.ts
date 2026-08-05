import { NextResponse } from 'next/server';
import { db, firebaseReady } from '@/lib/firebaseAdmin';
import { deleteFiles } from '@/lib/fileStore';

/**
 * 현장 기록(TBM일지·아차사고·작업인원·위험성평가 등) 저장 API — Cloud Firestore 기반.
 * - 기록 1건 = records/{type}/entries/{id} 문서 (같은 id로 덮어쓰므로 동시 작성 충돌 없음)
 * - 모든 요청은 x-passcode 헤더가 환경변수 SJ_PASSCODE와 일치해야 한다.
 * - Firebase 자격증명이나 암호가 설정되지 않았으면 503 → 클라이언트는 로컬 저장으로 폴백.
 */
const TYPES = new Set([
  'tbm',
  'nearmiss',
  'workforce',
  'risk',
  'yncc-workers',
  'yncc-vehicles',
  'chem-workers',
  'cards',
  'workplan',
  'annual-plan',
  'memo',
  'pass-vehicles',
  'health',
  'supervisor',
  'detectors',
  'vehicle-service',
  'equipment',
  'inventory',
]);

/** 기록 종류별 컬렉션 — records/{type}/entries/{id} */
function entriesOf(type: string) {
  return db().collection('records').doc(type).collection('entries');
}

function gate(req: Request): NextResponse | null {
  if (!firebaseReady()) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503 });
  }
  const pass = process.env.SJ_PASSCODE;
  if (!pass) {
    return NextResponse.json({ error: 'passcode_not_configured' }, { status: 503 });
  }
  if (req.headers.get('x-passcode') !== pass) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

function badType(): NextResponse {
  return NextResponse.json({ error: 'bad_type' }, { status: 400 });
}

/** 자격증명 오류 등 저장소 접근 실패 — 클라이언트가 로컬로 폴백하도록 503 */
function unavailable(e: unknown): NextResponse {
  console.error('firestore access failed:', e);
  return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
}

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  if (!TYPES.has(type)) return badType();
  const denied = gate(req);
  if (denied) return denied;

  try {
    const snap = await entriesOf(type).get();
    return NextResponse.json({ entries: snap.docs.map((d) => d.data()) });
  } catch (e) {
    return unavailable(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  if (!TYPES.has(type)) return badType();
  const denied = gate(req);
  if (denied) return denied;

  let entry: Record<string, unknown>;
  try {
    entry = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const id = typeof entry.id === 'string' ? entry.id : '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  }
  if (JSON.stringify(entry).length > 200_000) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  try {
    await entriesOf(type).doc(id).set(entry);
  } catch (e) {
    return unavailable(e);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  if (!TYPES.has(type)) return badType();
  const denied = gate(req);
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  }
  try {
    const ref = entriesOf(type).doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      // 첨부 사진(photoUrls)이 있는 기록이면 사진도 함께 삭제
      const urls = (snap.data() as { photoUrls?: unknown }).photoUrls;
      if (Array.isArray(urls)) {
        await deleteFiles(urls.filter((u): u is string => typeof u === 'string'));
      }
      await ref.delete();
    }
  } catch (e) {
    return unavailable(e);
  }
  return NextResponse.json({ ok: true });
}
