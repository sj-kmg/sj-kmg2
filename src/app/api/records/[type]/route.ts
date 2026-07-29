import { list, put, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

/**
 * 현장 기록(TBM일지·아차사고·작업인원·위험성평가) 저장 API — Vercel Blob 기반.
 * - 기록 1건 = records/{type}/{id}.json (덮어쓰기 방식이라 동시 작성 충돌 없음)
 * - 모든 요청은 x-passcode 헤더가 환경변수 SJ_PASSCODE와 일치해야 한다.
 * - Blob 저장소나 암호가 설정되지 않았으면 503 → 클라이언트는 로컬 저장으로 폴백.
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
]);

function gate(req: Request): NextResponse | null {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
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

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  if (!TYPES.has(type)) return badType();
  const denied = gate(req);
  if (denied) return denied;

  const { blobs } = await list({ prefix: `records/${type}/`, limit: 1000 });
  const entries = await Promise.all(
    blobs.map(async (b) => {
      try {
        const r = await fetch(b.url, { cache: 'no-store' });
        return (await r.json()) as Record<string, unknown>;
      } catch {
        return null;
      }
    }),
  );
  return NextResponse.json({ entries: entries.filter(Boolean) });
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
  const body = JSON.stringify(entry);
  if (body.length > 200_000) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  await put(`records/${type}/${id}.json`, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
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
  const { blobs } = await list({ prefix: `records/${type}/${id}.json`, limit: 1 });
  if (blobs[0]) {
    // 첨부 사진(photoUrls)이 있는 기록이면 사진도 함께 삭제
    try {
      const r = await fetch(blobs[0].url, { cache: 'no-store' });
      const entry = (await r.json()) as { photoUrls?: string[] };
      if (Array.isArray(entry.photoUrls) && entry.photoUrls.length > 0) {
        await del(entry.photoUrls.filter((u) => typeof u === 'string'));
      }
    } catch {
      // 사진 삭제 실패는 무시하고 기록만 삭제
    }
    await del(blobs[0].url);
  }
  return NextResponse.json({ ok: true });
}
