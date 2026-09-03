import fs from 'node:fs/promises';
import path from 'node:path';
import { POST as docExtract } from '../doc-extract/route';

/**
 * 임시 확인용 — 배포된 서버에서 스캔 서류 AI 판독이 실제로 되는지 본다.
 * 확인이 끝나면 지운다. 이미 공개돼 있는 public/certs 파일만 다룬다.
 */
export const maxDuration = 120;
const TOKEN = 'f09b60e7d531c85ef266fff6f8ee6834';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get('t') !== TOKEN) return new Response('nope', { status: 404 });
  const name = (q.get('f') ?? '86저0128_자동차등록증.pdf').replace(/[\/]/g, '');
  const hint = q.get('hint') ?? '자동차등록증';
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public/certs/yncc-vehicles', name));
    const dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
    const t = Date.now();
    // 실제 화면이 부르는 그 경로를 그대로 태운다 (프롬프트·모델·인증까지 동일)
    const res = await docExtract(
      new Request('http://local/api/doc-extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-passcode': process.env.SJ_PASSCODE ?? '' },
        body: JSON.stringify({ dataUrl, hint }),
      }),
    );
    const body = await res.json();
    return Response.json({ file: name, hint, status: res.status, ms: Date.now() - t, ...body });
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 400) }, { status: 500 });
  }
}
