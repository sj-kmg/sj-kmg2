import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { firebaseReady } from '@/lib/firebaseAdmin';
import { photoPath, saveFile } from '@/lib/fileStore';
import { pdfFirstPageJpeg } from '@/lib/pdfRender';
import { expiryFromText } from '@/lib/docDates';
import type { CertKind } from '@/lib/certExpiry';

/** 교육 수료증 업로드 — PDF·이미지 dataURL을 받아 Cloud Storage에 저장 (최대 8MB) */
const TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(req: Request) {
  if (!firebaseReady()) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503 });
  }
  // 사진·서류 업로드는 현장 계정도 할 수 있다 (아차사고 사진 등)
  const { role, notConfigured } = await checkAuth(req);
  if (notConfigured) {
    return NextResponse.json({ error: 'passcode_not_configured' }, { status: 503 });
  }
  if (!role) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // 열람 전용 계정은 업로드도 할 수 없다
  if (role === 'viewer') {
    return NextResponse.json({ error: 'read_only' }, { status: 403 });
  }

  let dataUrl = '';
  let name = '';
  let expiryKind: CertKind | null = null;
  try {
    const body = (await req.json()) as { dataUrl?: string; name?: string; expiryKind?: string };
    dataUrl = body.dataUrl ?? '';
    name = (body.name ?? 'cert').replace(/[^\w가-힣.-]/g, '_').slice(0, 60);
    if (body.expiryKind === 'inspection' || body.expiryKind === 'insurance') expiryKind = body.expiryKind;
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
  try {
    const path = `certs/${Date.now()}-${name}.${ext}`;
    const url = await saveFile(path, buffer, m[1]);

    /*
     * PDF는 올리는 즉시 사진 판을 함께 만들어 둔다.
     * 휴대폰마다 PDF 뷰어가 달라 안 열리는 기기가 있어, 화면에는 이 사진을 띄운다.
     * 변환이 안 돼도 첨부 자체는 성공으로 둔다 — 보기는 원본 PDF로 넘어간다.
     */
    if (ext === 'pdf') {
      const jpeg = await pdfFirstPageJpeg(buffer);
      if (jpeg) {
        await saveFile(photoPath(path), jpeg, 'image/jpeg');
      }
    }

    /*
     * 유효기간이 있는 서류(차량등록증·보험증권)는 만료일도 읽어 본다.
     * 스캔본은 글자층이 없어 못 읽는데, 그때는 넘겨짚지 않고 비워 둔다
     * (화면에서 '만료일 확인'으로 남아 사람이 직접 넣는다).
     */
    let expiresAt: string | null = null;
    if (expiryKind && ext === 'pdf') {
      expiresAt = await readExpiry(buffer, expiryKind);
    }
    return NextResponse.json({ url, expiresAt });
  } catch (e) {
    console.error('cert upload failed:', e);
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}

/** 서류 글자층에서 만료일 — 못 읽으면 null (첨부 자체는 성공시킨다) */
async function readExpiry(pdf: Buffer, kind: CertKind): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(doc, { mergePages: true });
    return expiryFromText(String(text ?? ''), kind);
  } catch (e) {
    console.error('만료일 읽기 실패:', e);
    return null;
  }
}
