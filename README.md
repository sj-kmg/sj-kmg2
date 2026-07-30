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

배포 주소: **https://sj-dashboard--sj-kmg-deploy2.asia-east1.hosted.app**

API 라우트(SSR)가 있으므로 정적 Hosting이 아닌 App Hosting을 쓴다. 구성은 아래와 같다.

| 항목 | 값 |
| --- | --- |
| 프로젝트 | `sj-kmg-deploy2` |
| App Hosting 백엔드 | `sj-dashboard` · `asia-east1`(대만) |
| Firestore · Cloud Storage | `asia-northeast3`(서울) |

App Hosting은 한국 리전을 지원하지 않아(가용: asia-east1 / asia-southeast1 / europe-west4 / us-central1 / us-east4 / us-east5) 가장 가까운 대만을 썼다. 데이터는 서울에 두었으므로 API 호출 시 리전 간 왕복이 한 번 추가된다.

배포:

```bash
firebase deploy --only apphosting
```

보안 규칙만 갱신할 때:

```bash
firebase deploy --only firestore:rules,storage
```

런타임 설정·환경변수는 [`apphosting.yaml`](apphosting.yaml)에서 관리한다. 시크릿은 Secret Manager에 등록한다:

```bash
firebase apphosting:secrets:set sj-passcode
```

> GitHub 저장소를 연결해 푸시 자동 배포를 쓰려면 `firebase apphosting:backends:create`를 대화형으로 실행해 저장소·브랜치를 지정하면 된다. 현재는 위 명령으로 로컬 소스를 직접 배포하는 방식이다.

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
