'use client';

import { useEffect, useState } from 'react';
import { fileHref } from './ids';
import { authHeaders } from './sync';

export type PhotoState = 'none' | 'loading' | 'ready' | 'failed';

/**
 * 첨부서류의 사진을 화면에 띄울 수 있는 주소로 바꾼다.
 *
 * 저장소에 함께 넣어 둔 정적 파일은 그대로 쓰면 되지만, 올린 서류는 `/api/certs/photo`가
 * 사진으로 바꿔 주고 이 요청에는 로그인 정보가 실려야 한다. `<img src="…">`로는 헤더를
 * 붙일 수 없어, 여기서 받아 온 뒤 브라우저 안의 임시 주소로 넘긴다.
 * (임시 주소는 같은 사이트 취급이라 [사진 저장]도 제대로 동작한다.)
 *
 * @param photo `certPhoto()`가 돌려준 사진 주소 — 아직 열지 않았으면 null
 */
export function useCertPhoto(photo: string | null): { src: string | null; state: PhotoState } {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<PhotoState>('none');

  useEffect(() => {
    if (!photo) {
      setSrc(null);
      setState('none');
      return;
    }
    // 정적 파일은 누구나 열 수 있다 — 브라우저 캐시를 그대로 쓰도록 손대지 않는다
    if (!photo.startsWith('/api/')) {
      setSrc(fileHref(photo));
      setState('ready');
      return;
    }

    let alive = true;
    let objectUrl = '';
    setSrc(null);
    setState('loading');
    void (async () => {
      try {
        const res = await fetch(photo, { headers: await authHeaders() });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setState('ready');
      } catch {
        if (alive) setState('failed');
      }
    })();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo]);

  return { src, state };
}
