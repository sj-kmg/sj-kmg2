import type { MetadataRoute } from 'next';

/**
 * 홈 화면에 설치되는 앱 정보.
 * 휴대폰에서 주소를 열고 [홈 화면에 추가]하면 이 설정대로 앱처럼 실행된다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '신정개발 안전관리',
    short_name: '안전관리',
    description: 'TBM일지·아차사고를 현장에서 작성하면 대시보드에 바로 공유됩니다.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ko',
    background_color: '#d9e3f4',
    theme_color: '#0891b2',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // 앱 아이콘을 길게 누르면 나오는 바로가기
    shortcuts: [
      {
        name: 'TBM일지 작성',
        short_name: 'TBM일지',
        url: '/?view=tbm',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: '아차사고 신고',
        short_name: '아차사고',
        url: '/?view=nearmiss',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
