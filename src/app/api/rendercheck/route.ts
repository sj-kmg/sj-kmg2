import fs from 'node:fs/promises';
import path from 'node:path';
import { pdfFirstPageJpeg } from '@/lib/pdfRender';

/**
 * 배포한 서버에서 PDF→사진 변환이 실제로 되는지 확인하는 임시 경로.
 * 확인이 끝나면 지운다. 이미 공개돼 있는 public/certs 파일만 다룬다.
 */
const TOKEN = '11c7216eb7367b0530c6f1cef6215d20';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get('t') !== TOKEN) return new Response('nope', { status: 404 });
  const name = (q.get('f') ?? '86저0128_자동차등록증.pdf').replace(/[\/]/g, '');
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public/certs/yncc-vehicles', name));
    const t = Date.now();
    const jpeg = await pdfFirstPageJpeg(buf);
    if (!jpeg) return new Response('convert_failed', { status: 500 });
    return new Response(new Uint8Array(jpeg), {
      headers: { 'Content-Type': 'image/jpeg', 'X-Ms': String(Date.now() - t) },
    });
  } catch (e) {
    return new Response('error: ' + String(e), { status: 500 });
  }
}
