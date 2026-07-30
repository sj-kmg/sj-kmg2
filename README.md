# 신정개발 안전관리 대시보드

㈜신정개발 안전공무 업무(위험성평가 · 안전교육 · 안전점검 · 아차사고 · 안전일정)를 한눈에 보여주는 웹 대시보드입니다.

## 데이터 보안 원칙

**엑셀 데이터 파일은 절대 이 저장소에 올라가지 않습니다.**

- 사용자가 브라우저에서 직접 엑셀 파일(`safety-data.xlsx`)을 선택하면, 파일은 **브라우저 안에서만** 파싱됩니다.
- 서버 전송·업로드·외부 저장이 없습니다. 파싱된 데이터는 사용자 브라우저의 localStorage에만 보관됩니다.
- `.gitignore`가 `*.xlsx`, `*.xls`, `*.xlsm`, `*.xlsb`, `*.csv`, `/data/`를 전면 차단하므로 실수로도 커밋되지 않습니다.

## 사용 방법

1. 배포된 대시보드 접속 (Firebase App Hosting)
2. 안전관리 데이터 엑셀 파일을 화면에 끌어다 놓기
3. 대시보드 / 위험성평가 / 작업목록 / 관리대장 탭에서 현황 확인
4. 엑셀을 수정한 뒤에는 "데이터 다시 불러오기"로 갱신

## 데이터 파일 양식

시트: `기준정보`, `요약`, `작업목록`, `위험성평가`(메인), `위험도기준`, `안전교육`, `안전점검`, `아차사고`, `안전일정`
— 각 시트는 1행이 열 제목인 플랫 테이블이어야 하며, 시트명과 열 제목은 변경하면 안 됩니다.

위험성 산식: **R = F(가능성 1~5) × S(중대성 1~4)**, 등급: 허용불가(16~20) / 중대(13~15) / 상당(9~12) / 경미(7~8) / 미미(3~6) / 무시가능(1~2)

## 현장 기록 동기화

TBM일지·아차사고·작업인원·건강검진·안전교육 등의 기록은 **Cloud Firestore**에, 수료증·검진결과서·현장 사진은 **Cloud Storage**에 저장된다. 모든 접근은 서버 API가 처리하며 `x-passcode` 헤더(= `SJ_PASSCODE`)가 일치해야 한다.

각 기기에서 기록 메뉴 첫 진입 시 암호를 한 번 입력하면 서버 동기화 모드(☁️)로 전환되고, 브라우저에 남아 있던 기존 기록은 자동으로 서버로 이관된다. 암호·자격증명이 설정되지 않은 환경(로컬 개발 등)에서는 API가 503을 돌려주고 기존처럼 브라우저 저장(💻)으로 동작한다.

저장 구조:

| 대상 | 위치 |
| --- | --- |
| 기록 1건 | Firestore `records/{종류}/entries/{id}` |
| 수료증·검진결과서 | Storage `certs/…` |
| 아차사고·위험성평가 사진 | Storage `photos/…` |

Firestore·Storage 보안 규칙은 브라우저에서의 직접 접근을 전면 차단한다(`firestore.rules`, `storage.rules`). 서버는 Admin SDK로 접근하므로 규칙의 영향을 받지 않으며, 첨부 파일은 업로드 시 발급되는 다운로드 토큰이 포함된 URL로만 열람된다.

## 배포 (Firebase App Hosting)

프로젝트: **sj-kmg-deploy2** — API 라우트(SSR)가 있으므로 정적 Hosting이 아닌 App Hosting을 사용한다.

최초 1회 설정:

```bash
firebase login
firebase apphosting:secrets:set sj-passcode
firebase apphosting:secrets:set google-generative-ai-api-key
firebase deploy --only firestore:rules,storage
firebase apphosting:backends:create --project sj-kmg-deploy2 --location asia-northeast3
```

`backends:create`에서 GitHub 저장소(`sj-kmg/sj-kmg2`)와 배포 브랜치(`main`)를 연결하면, 이후에는 **main에 푸시할 때마다 자동으로 빌드·배포**된다. 런타임 설정과 환경변수는 [`apphosting.yaml`](apphosting.yaml)에서 관리한다.

## 개발

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # 프로덕션 빌드
```

로컬에서 서버 동기화까지 테스트하려면 자격증명과 환경변수가 필요하다:

```bash
gcloud auth application-default login
```

`.env.local` (커밋되지 않음):

```
FIREBASE_PROJECT_ID=sj-kmg-deploy2
FIREBASE_STORAGE_BUCKET=sj-kmg-deploy2.firebasestorage.app
SJ_PASSCODE=<동기화 암호>
GOOGLE_GENERATIVE_AI_API_KEY=<Google AI Studio 키>   # 선택
```

스택: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Firebase(App Hosting · Firestore · Cloud Storage) · SheetJS(클라이언트 사이드 엑셀 파싱)
