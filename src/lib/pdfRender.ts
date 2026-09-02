/**
 * PDF 첫 장을 사진(JPEG)으로 바꾼다 — 서버 전용.
 *
 * 휴대폰마다 PDF 뷰어가 달라 첨부가 안 열리는 기기가 있다. 그래서 올라온 서류는
 * 서버에서 곧바로 사진 판을 만들어 나란히 저장해 두고, 화면에서는 그 사진을 띄운다.
 * 브라우저에서 바꾸면 기기·브라우저마다 결과가 갈리기 때문에 서버 한 곳에서 처리한다.
 */
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

/** 글씨가 읽히면서 파일이 너무 커지지 않는 선 */
const MAX_WIDTH = 1600;
const QUALITY = 82;

/**
 * pdf.js가 참고 자료를 찾는 위치.
 *
 * 스캔한 서류는 대부분 JBIG2로 압축돼 있고, pdf.js는 그걸 푸는 코드를 별도 wasm 파일로
 * 두고 있다. 이 위치를 알려 주지 않으면 검은 글씨층이 통째로 빠져 표만 남은 빈 종이가 나온다.
 * 그래서 실제로 파일이 있는지 확인한 자리만 쓰고, 못 찾으면 변환을 포기한다
 * (빈 종이를 서류라고 내보내는 것보다 원본 PDF로 넘기는 편이 안전하다).
 *
 * 배포된 서버는 Next가 추려 낸 `.next/standalone`에서 돌아가 폴더 구조가 다르다.
 * 게다가 번들러가 `import.meta.url`을 숫자 모듈 번호로 바꿔 버려 그 기준은 쓸 수 없다.
 * 그래서 앱 폴더 아래를 먼저 보고, 안 되면 평소 방식으로 되돌아간다.
 */
function assetDirs() {
  const roots: string[] = [path.join(process.cwd(), 'node_modules', 'pdfjs-dist')];
  for (const base of [path.join(process.cwd(), 'package.json'), import.meta.url as unknown as string]) {
    try {
      roots.push(path.dirname(createRequire(base).resolve('pdfjs-dist/package.json')));
    } catch {
      // 이 기준으로는 못 찾는다 — 다음 후보로
    }
  }

  for (const root of roots) {
    // 스캔 서류를 풀어 낼 wasm이 실제로 있는 자리인지 확인한다
    if (!existsSync(path.join(root, 'wasm', 'jbig2.wasm'))) continue;
    const dir = root.split(path.sep).join('/');
    return {
      wasmUrl: `${dir}/wasm/`,
      standardFontDataUrl: `${dir}/standard_fonts/`,
      cMapUrl: `${dir}/cmaps/`,
    };
  }
  throw new Error(`pdfjs-dist 자료를 찾지 못했습니다 (찾아본 곳: ${roots.join(', ')})`);
}

/**
 * 첫 장을 JPEG으로. 바꾸지 못하면 null (첨부 자체는 실패시키지 않는다).
 */
export async function pdfFirstPageJpeg(pdf: Buffer): Promise<Buffer | null> {
  try {
    const [pdfjs, canvasMod, dirs] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('@napi-rs/canvas'),
      Promise.resolve(assetDirs()),
    ]);

    const task = pdfjs.getDocument({
      data: new Uint8Array(pdf),
      ...dirs,
      cMapPacked: true,
      // 서버에는 브라우저 글꼴 API가 없다 — 내장 글꼴로만 그린다
      disableFontFace: true,
      useSystemFonts: false,
    });
    try {
      const doc = await task.promise;
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      // 원본이 작은 서류를 3배 넘게 늘려 봐야 흐려지기만 한다
      const viewport = page.getViewport({ scale: Math.min(MAX_WIDTH / base.width, 3) });
      const canvas = canvasMod.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      // JPEG에는 투명이 없다 — 흰 종이를 먼저 깔지 않으면 배경이 검게 나온다
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // @napi-rs/canvas는 브라우저 캔버스와 형태만 조금 달라 타입을 맞춰 넘긴다
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      return canvas.toBuffer('image/jpeg', QUALITY);
    } finally {
      await task.destroy();
    }
  } catch (e) {
    console.error('PDF → 사진 변환 실패:', e);
    return null;
  }
}
