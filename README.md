# Int_web

Google Sheets와 연결해 어느 기기에서든 같은 사이트 목록을 볼 수 있는 개인 통합 웹 대시보드입니다.

## 주요 기능

- Google Sheets 기반 사이트 목록 동기화
- 카드형 사이트 런처
- 사이트 추가, 수정, 삭제
- JSON 가져오기와 내보내기
- 검색, 카테고리 필터, 즐겨찾기, 최근 방문
- 대표 URL, 관리자 URL, GitHub, 문서 URL 묶음
- Health URL 기반 상태 점검
- 모바일 우선 레이아웃과 하단 빠른 메뉴

사이트 목록은 브라우저에 저장하지 않습니다. 즐겨찾기와 최근 방문만 개인 편의 정보로 각 기기의 브라우저에 저장됩니다.

## 실행 방법

의존성이 없는 정적 웹앱입니다. Node.js가 있으면 바로 실행할 수 있습니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:4173`을 열면 됩니다.

## Google Sheets 연결

`config.js`에는 요청한 Google Sheets ID가 이미 들어 있습니다.

```js
window.INT_WEB_CONFIG = {
  sheetId: "1biZUbR5uY654A8WShsdMdzn5Y-bPudODo-GsIYu9YFo",
  gid: "0",
  apiUrl: ""
};
```

읽기만 필요하면 시트를 공개 또는 게시해두면 앱이 Google Sheets에서 목록을 읽어옵니다. 사이트 추가, 수정, 삭제까지 앱에서 하려면 Google Apps Script 웹앱 URL을 `apiUrl`에 넣어야 합니다.

## Apps Script 배포

1. Google Sheets에서 `확장 프로그램 > Apps Script`를 엽니다.
2. `google-apps-script/Code.gs` 내용을 붙여 넣습니다.
3. `배포 > 새 배포 > 웹 앱`을 선택합니다.
4. 실행 권한은 본인, 액세스 권한은 앱을 사용할 범위에 맞게 설정합니다.
5. 배포 후 생성된 웹 앱 URL을 `config.js`의 `apiUrl`에 붙여 넣습니다.

## 시트 헤더

첫 번째 행은 아래 헤더를 권장합니다.

```text
id, name, description, category, tags, url, adminUrl, repoUrl, docsUrl, healthUrl, imageUrl, memo
```

## 배포 메모

정적 파일만으로 동작하므로 GitHub Pages, Vercel, Netlify에 배포할 수 있습니다. 개인용으로 공개 인터넷에 배포할 경우, 플랫폼의 인증 보호나 별도 로그인 레이어를 붙이는 것을 권장합니다.
