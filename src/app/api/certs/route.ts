import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

/** 교육 수료증 업로드 — PDF·이미지 dataURL을 받아 Blob에 저장 (최대 8MB) */
const TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(req: Request) {
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

  let dataUrl = '';
  let name = '';
  try {
    const body = (await req.json()) as { dataUrl?: string; name?: string };
    dataUrl = body.dataUrl ?? '';
    name = (body.name ?? 'cert').replace(/[^\w가-힣.-]/g, '_').slice(0, 60);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const m = dataUrl.match(/^data:([\w/+-]+);base64,([A-Za-z0-9+/=]+)$/);
  const ext = m ? TYPES[m[1]] : undefined;
  if (!m || !ext) {
    return NextResponse.json({ error: 'bad_file' }, { status: 400 });
  }
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.byteLength > 8_000_000) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  const blob = await put(`certs/${Date.now()}-${name}.${ext}`, buffer, {
    access: 'public',
    contentType: m[1],
  });
  return NextResponse.json({ url: blob.url });
}
