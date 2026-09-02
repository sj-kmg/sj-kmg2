import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * PDF를 사진으로 굽는 두 꾸러미는 묶지 않고 그대로 쓴다.
   * @napi-rs/canvas는 운영체제별 실행 파일을 들고 있고, pdf.js는 글꼴·wasm 같은
   * 곁딸린 파일을 자기 폴더에서 찾기 때문에, 번들에 말아 넣으면 못 찾는다.
   */
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],

  /*
   * 배포본은 Next가 추려 낸 파일만 들고 간다. wasm·글꼴·cMap은 코드에서 import하지 않아
   * 자동으로는 빠지는데, 없으면 스캔 서류가 빈 종이로 나온다. 그래서 명시적으로 담는다.
   */
  outputFileTracingIncludes: {
    '/api/certs': ['./node_modules/pdfjs-dist/wasm/**', './node_modules/pdfjs-dist/standard_fonts/**', './node_modules/pdfjs-dist/cmaps/**'],
    '/api/certs/photo': ['./node_modules/pdfjs-dist/wasm/**', './node_modules/pdfjs-dist/standard_fonts/**', './node_modules/pdfjs-dist/cmaps/**'],
  },

  /**
   * 첨부파일(수료증·등록증 등)은 [보기]를 누르면 내려받지 않고 브라우저에서 바로 열려야 한다.
   * 정적 파일에는 기본적으로 Content-Disposition이 붙지 않아 브라우저 기본 동작에 맡겨지는데,
   * 일부 브라우저·중계 서버가 이를 내려받기로 처리하는 경우가 있어 inline을 명시한다.
   */
  async headers() {
    return [
      {
        source: '/certs/:path*',
        headers: [{ key: 'Content-Disposition', value: 'inline' }],
      },
    ];
  },
};

export default nextConfig;
