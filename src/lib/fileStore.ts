/**
 * Cloud Storage for Firebase 파일 저장 (서버 전용).
 *
 * 공개 URL은 Firebase 다운로드 토큰 방식을 쓴다 — 객체를 public ACL로 열지 않아도
 * 토큰을 아는 사람만 열람할 수 있고, uniform bucket-level access가 켜진 버킷에서도 동작한다.
 */
import { randomUUID } from 'node:crypto';
import { bucket, bucketName } from './firebaseAdmin';

const HOST = 'https://firebasestorage.googleapis.com';

/**
 * 파일을 저장하고 열람용 공개 URL을 돌려준다.
 * `reuseToken`을 주면 그 토큰으로 저장한다 — 같은 서류의 PDF와 사진 판이 한 쌍으로 묶인다.
 * `contentDisposition: inline`을 지정해, 클릭하면 다운로드되지 않고 새 탭에서 바로 열리게 한다
 * (지정하지 않으면 브라우저·파일 형식에 따라 곧장 저장 대화상자가 뜨는 경우가 있다).
 */
export async function saveFile(path: string, buffer: Buffer, contentType: string, reuseToken?: string): Promise<string> {
  const token = reuseToken ?? randomUUID();
  await bucket()
    .file(path)
    .save(buffer, {
      resumable: false,
      contentType,
      metadata: {
        contentType,
        contentDisposition: 'inline',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
  return `${HOST}/v0/b/${bucketName()}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

/**
 * 저장 URL에서 객체 경로를 복원한다.
 * 이 버킷의 파일이 아니면(예: 이전 Vercel Blob URL) null — 삭제 대상에서 제외된다.
 */
export function pathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin !== HOST) return null;
    const m = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(u.pathname);
    if (!m || m[1] !== bucketName()) return null;
    return decodeURIComponent(m[2]);
  } catch {
    return null;
  }
}

/** 첨부 파일 일괄 삭제 — 개별 실패는 무시하고 나머지를 계속 지운다 */
export async function deleteFiles(urls: string[]): Promise<void> {
  const paths = urls.map(pathFromUrl).filter((p): p is string => !!p);
  await Promise.all(
    paths.map(async (p) => {
      try {
        await bucket().file(p).delete({ ignoreNotFound: true });
      } catch {
        // 파일 삭제 실패는 기록 삭제를 막지 않는다
      }
    }),
  );
}

/**
 * 같은 서류의 사진 판이 놓이는 자리. `certs/…_등록증.pdf` → `certs/…_등록증.photo.jpg`
 * 확장자만 바꾸면 사람이 올린 같은 이름의 JPG와 부딪힐 수 있어 `.photo.jpg`로 구분한다.
 */
export function photoPath(pdfPath: string): string {
  return pdfPath.replace(/\.pdf$/i, '') + '.photo.jpg';
}

/** 저장된 파일 읽기 — 없으면 null */
export async function readFile(path: string): Promise<Buffer | null> {
  try {
    const file = bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return buf;
  } catch {
    return null;
  }
}

/** 저장할 때 붙여 둔 열람 토큰 — 사진 판을 원본과 같은 토큰으로 묶을 때 쓴다 */
export async function fileToken(path: string): Promise<string | undefined> {
  try {
    const [meta] = await bucket().file(path).getMetadata();
    const raw = (meta.metadata as Record<string, unknown> | undefined)?.firebaseStorageDownloadTokens;
    return typeof raw === 'string' ? raw.split(',')[0] : undefined;
  } catch {
    return undefined;
  }
}
