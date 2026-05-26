# Int_web

Google Sheets API와 연결해 어느 기기에서든 같은 사이트 목록을 볼 수 있는 개인 통합 웹 대시보드입니다.

## 주요 기능

- `/api/sites` 서버 API 기반 Google Sheets 동기화
- 카드형 사이트 런처
- 사이트 추가, 수정, 삭제
- JSON 가져오기와 내보내기
- 검색, 카테고리 필터, 즐겨찾기, 최근 방문
- 대표 URL, 관리자 URL, GitHub, 문서 URL 묶음
- Health URL 기반 상태 점검
- 모바일 우선 레이아웃과 하단 빠른 메뉴

사이트 목록은 브라우저에 저장하지 않습니다. 즐겨찾기와 최근 방문만 개인 편의 정보로 각 기기의 브라우저에 저장됩니다.

## 실행 방법

정적 프론트엔드는 Node.js로 바로 확인할 수 있습니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:4173`을 열면 됩니다. 로컬 정적 서버는 `/api/sites`를 실행하지 않으므로, API 검증은 Vercel 같은 서버리스 환경에서 확인하세요.

## API 구조

프론트엔드는 같은 도메인의 `/api/sites`만 호출합니다.

```text
GET    /api/sites              목록 조회
POST   /api/sites              사이트 추가
PUT    /api/sites              사이트 수정
DELETE /api/sites              사이트 삭제
POST   /api/sites replaceAll   JSON 가져오기로 전체 교체
```

## Google Sheets 설정

API는 Google 서비스 계정으로 Sheets API를 호출합니다. Google Cloud에서 서비스 계정을 만들고, 대상 스프레드시트를 서비스 계정 이메일에 공유하세요.

필요한 환경변수:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_SHEETS_ID=1biZUbR5uY654A8WShsdMdzn5Y-bPudODo-GsIYu9YFo
GOOGLE_SHEET_GID=0
INT_WEB_WRITE_TOKEN=선택사항_쓰기_보호_토큰
```

`INT_WEB_WRITE_TOKEN`을 설정하면 추가, 수정, 삭제 때 관리 토큰을 묻습니다. 읽기는 토큰 없이 가능합니다.

## 시트 헤더

첫 번째 행은 아래 헤더를 권장합니다. API가 비어 있는 시트에는 자동으로 헤더를 생성합니다.

```text
id, name, description, category, tags, url, adminUrl, repoUrl, docsUrl, healthUrl, imageUrl, memo
```

## 배포 메모

`api/sites.js`는 Vercel Serverless Function 형태입니다. Vercel에 배포한 뒤 프로젝트 환경변수에 위 값을 넣으면, 모든 기기에서 같은 Google Sheets 데이터를 보게 됩니다.
