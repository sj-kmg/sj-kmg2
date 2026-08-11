import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { firebaseReady } from '@/lib/firebaseAdmin';
import { saveFile } from '@/lib/fileStore';

/** 아차사고 첨부 사진 업로드 — 클라이언트에서 축소된 JPEG dataURL을 받아 Cloud Storage에 저장 */
export async function POST(req: Request) {
  if (!firebaseReady()) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503 });
  }
  // 사진·서류 업로드는 현장 계정도 할 수 있다 (아차사고 사진 등)
  const { role, notConfigured } = checkAuth(req);
  if (notConfigured) {
    return NextResponse.json({ error: 'passcode_not_configured' }, { status: 503 });
  }
  if (!role) {
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
  try {
    const url = await saveFile(`photos/${id}.jpg`, buffer, `image/${m[1]}`);
    return NextResponse.json({ url });
  } catch (e) {
    console.error('photo upload failed:', e);
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}
