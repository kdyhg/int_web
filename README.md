# Int_web

자주 사용하는 개인 제작 사이트를 한 곳에서 찾고 관리하는 통합 웹 대시보드입니다.

## 주요 기능

- 사이트 카드형 런처
- 검색 및 카테고리 필터
- 즐겨찾기 저장
- 최근 방문 기록 표시
- Production, Admin, GitHub, Docs 등 관련 링크 묶음
- Health URL 기반 상태 점검
- 정적 파일만으로 동작하여 GitHub Pages, Vercel, Netlify에 쉽게 배포 가능

## 실행 방법

의존성이 없는 정적 웹앱입니다. Node.js가 있으면 바로 실행할 수 있습니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:4173`을 열면 됩니다.

## 사이트 추가/수정

`data/sites.json` 파일의 `sites` 배열에 항목을 추가하세요.

```json
{
  "id": "portfolio",
  "name": "Portfolio",
  "description": "개인 포트폴리오 사이트",
  "category": "production",
  "tags": ["portfolio", "public"],
  "url": "https://example.com",
  "adminUrl": "",
  "repoUrl": "https://github.com/me/portfolio",
  "docsUrl": "",
  "healthUrl": "https://example.com",
  "memo": "배포 전 모바일 화면을 확인합니다."
}
```

## 다음 확장 아이디어

- 로그인 보호
- 사이트별 비공개 메모 저장
- 서버 API를 통한 정확한 상태 체크
- GitHub/Vercel 배포 상태 연동
- 팀 단위 공유 대시보드
