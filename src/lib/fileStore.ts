/**
 * Cloud Storage for Firebase 파일 저장 (서버 전용).
 *
 * 공개 URL은 Firebase 다운로드 토큰 방식을 쓴다 — 객체를 public ACL로 열지 않아도
 * 토큰을 아는 사람만 열람할 수 있고, uniform bucket-level access가 켜진 버킷에서도 동작한다.
 */
import { randomUUID } from 'node:crypto';
import { bucket, bucketName } from './firebaseAdmin';

const HOST = 'https://firebasestorage.googleapis.com';

/** 파일을 저장하고 열람용 공개 URL을 돌려준다 */
export async function saveFile(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const token = randomUUID();
  await bucket()
    .file(path)
    .save(buffer, {
      resumable: false,
      contentType,
      metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } },
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
