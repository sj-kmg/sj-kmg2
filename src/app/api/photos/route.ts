import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

/** 아차사고 첨부 사진 업로드 — 클라이언트에서 축소된 JPEG dataURL을 받아 Blob에 저장 */
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
  try {
    const body = (await req.json()) as { dataUrl?: string };
    dataUrl = body.dataUrl ?? '';
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) {
    return NextResponse.json({ error: 'bad_image' }, { status: 400 });
  }
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.byteLength > 2_000_000) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }
  const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blob = await put(`photos/${id}.jpg`, buffer, {
    access: 'public',
    contentType: `image/${m[1]}`,
  });
  return NextResponse.json({ url: blob.url });
}
