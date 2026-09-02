'use client';

/**
 * PDF를 사진으로 바꾸기 (브라우저에서).
 *
 * 휴대폰마다 PDF 뷰어가 달라 안 열리는 기기가 있어, 서류를 올리는 순간
 * 첫 장을 사진(JPEG)으로 만들어 원본과 함께 저장한다.
 * 화면에서는 사진을 띄우고, 인쇄가 필요할 때만 원본 PDF를 연다.
 *
 * pdf.js는 덩치가 커서 **파일을 올리는 순간에만** 불러온다 (필요할 때만 내려받는다).
 */

/** 휴대폰 화면에 충분하면서 파일이 너무 커지지 않는 가로 폭 */
const MAX_WIDTH = 1600;
const QUALITY = 0.82;

/** 이 파일이 PDF인지 — 이미지면 변환할 필요가 없다 */
export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * PDF 첫 장을 JPEG data URL로 만든다.
 * 변환할 수 없으면 null을 돌려주고, 화면은 원본 PDF만 저장한 채로 진행한다.
 */
export async function pdfFirstPageToJpeg(file: File): Promise<string | null> {
  try {
    const pdfjs = await import('pdfjs-dist');
    // 워커는 public에 복사해 두고 주소로 직접 가리킨다 (번들러 설정에 기대지 않는다)
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const page = await doc.getPage(1);

    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_WIDTH / base.width, 2.5);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // 흰 바탕을 깔아 둔다 — JPEG는 투명을 표현하지 못해 검게 나올 수 있다
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
    await doc.cleanup();
    return dataUrl.startsWith('data:image/jpeg') ? dataUrl : null;
  } catch (e) {
    console.error('pdf → 사진 변환 실패:', e);
    return null;
  }
}

