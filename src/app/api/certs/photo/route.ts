import { checkAuth } from '@/lib/auth';
import { firebaseReady } from '@/lib/firebaseAdmin';
import { pathFromUrl, photoPath, readFile, saveFile } from '@/lib/fileStore';
import { pdfFirstPageJpeg } from '@/lib/pdfRender';

/**
 * 첨부서류의 사진 판을 내려 준다 — `/api/certs/photo?src=<첨부 주소>`
 *
 * 올릴 때 이미 사진을 만들어 두지만, 그 기능이 생기기 전에 올라온 서류는 사진이 없다.
 * 그런 서류는 여기서 처음 열릴 때 만들어 저장해 두고, 다음부터는 만들어 둔 것을 바로 준다.
 * 결과적으로 지금까지 올라온 파일까지 전부 사진으로 보이게 된다.
 *
 * 저장소 주소로 곧장 연결하지 않고 이 경로를 거치는 이유는 두 가지다.
 *  - 같은 사이트에서 내려오므로 [사진 저장]이 실제 저장으로 동작한다
 *    (다른 도메인 파일은 브라우저가 저장 대신 그냥 열어 버린다)
 *  - 아직 사진이 없는 서류도 링크가 깨지지 않는다
 */
export async function GET(req: Request) {
  if (!firebaseReady()) {
    return new Response('storage_not_configured', { status: 503 });
  }
  // 사진 보기는 읽기다 — 열람 전용 계정도 볼 수 있어야 한다
  const { role } = await checkAuth(req);
  if (!role) {
    return new Response('unauthorized', { status: 401 });
  }

  const src = new URL(req.url).searchParams.get('src') ?? '';
  const pdfPath = pathFromUrl(src);
  // 이 버킷의 certs/ 아래 PDF만 — 남의 주소를 넣어 서버로 내려받게 하지 않는다
  if (!pdfPath || !pdfPath.startsWith('certs/') || !/\.pdf$/i.test(pdfPath)) {
    return new Response('bad_src', { status: 400 });
  }

  const jpgPath = photoPath(pdfPath);
  let jpeg = await readFile(jpgPath);

  if (!jpeg) {
    const pdf = await readFile(pdfPath);
    if (!pdf) {
      return new Response('not_found', { status: 404 });
    }
    jpeg = await pdfFirstPageJpeg(pdf);
    if (!jpeg) {
      // 바꾸지 못하는 서류다 — 화면은 원본 PDF 열기로 넘어간다
      return new Response('convert_failed', { status: 415 });
    }
    // 다음 사람은 기다리지 않도록 만들어 둔다. 저장에 실패해도 이번 응답은 내보낸다
    try {
      await saveFile(jpgPath, jpeg, 'image/jpeg');
    } catch (e) {
      console.error('사진 판 저장 실패:', e);
    }
  }

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(jpeg.byteLength),
      'Content-Disposition': 'inline',
      // 서류 내용은 바뀌지 않는다 — 한 번 받은 기기는 다시 받지 않게 한다
      'Cache-Control': 'private, max-age=604800, immutable',
    },
  });
}
