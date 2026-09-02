import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pdfFirstPageJpeg } from '@/lib/pdfRender';

/**
 * 배포한 서버에서 PDF→사진 변환이 실제로 되는지 확인하는 임시 경로.
 * 확인이 끝나면 지운다. 이미 공개돼 있는 public/certs 파일만 다룬다.
 */
const TOKEN = '11c7216eb7367b0530c6f1cef6215d20';

async function probe() {
  const out: Record<string, unknown> = { cwd: process.cwd() };
  const roots = [path.join(process.cwd(), 'node_modules', 'pdfjs-dist')];
  try {
    roots.push(path.dirname(createRequire(path.join(process.cwd(), 'package.json')).resolve('pdfjs-dist/package.json')));
  } catch (e) {
    out.resolveErr = String(e).slice(0, 120);
  }
  for (const root of roots) {
    const info: Record<string, string> = {};
    for (const d of ['wasm', 'standard_fonts', 'cmaps']) {
      try {
        info[d] = (await fs.readdir(path.join(root, d))).length + '개';
      } catch {
        info[d] = '없음';
      }
    }
    out[root] = info;
  }
  try {
    const c = await import('@napi-rs/canvas');
    out.canvas = c.createCanvas(4, 4).toBuffer('image/jpeg', 80).length + ' bytes OK';
  } catch (e) {
    out.canvas = 'X ' + String(e).slice(0, 200);
  }
  try {
    await import('pdfjs-dist/legacy/build/pdf.mjs');
    out.pdfjs = 'OK';
  } catch (e) {
    out.pdfjs = 'X ' + String(e).slice(0, 200);
  }
  return out;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get('t') !== TOKEN) return new Response('nope', { status: 404 });
  if (q.get('probe')) return Response.json(await probe());

  const name = (q.get('f') ?? '86저0128_자동차등록증.pdf').replace(/[\/]/g, '');
  const errs: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { errs.push(a.map((x) => String(x)).join(' ')); orig(...a); };
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public/certs/yncc-vehicles', name));
    const t = Date.now();
    const jpeg = await pdfFirstPageJpeg(buf);
    if (!jpeg) return new Response('convert_failed: ' + errs.join(' | ').slice(0, 3000), { status: 500 });
    return new Response(new Uint8Array(jpeg), {
      headers: { 'Content-Type': 'image/jpeg', 'X-Ms': String(Date.now() - t) },
    });
  } catch (e) {
    return new Response('error: ' + String(e).slice(0, 800), { status: 500 });
  } finally {
    console.error = orig;
  }
}
