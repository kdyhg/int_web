# Int_web

내가 만든 사이트를 카드 형태로 추가, 수정, 삭제하고 빠르게 접속하는 개인 통합 웹 대시보드입니다.

## 주요 기능

- 카드형 사이트 런처
- 사이트 추가, 수정, 삭제
- 브라우저 `localStorage` 저장
- JSON 가져오기와 내보내기
- 검색, 카테고리 필터, 즐겨찾기, 최근 방문
- 대표 URL, 관리자 URL, GitHub, 문서 URL 묶음
- Health URL 기반 상태 점검
- 흑백/소프트 그레이 중심의 플랫 카드 디자인

## 실행 방법

의존성이 없는 정적 웹앱입니다. Node.js가 있으면 바로 실행할 수 있습니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:4173`을 열면 됩니다.

## 사이트 목록 관리

첫 로딩에는 `data/sites.json`의 샘플 데이터가 표시됩니다. 이후 화면에서 사이트를 추가, 수정, 삭제하면 변경 사항은 현재 브라우저의 `localStorage`에 저장됩니다.

다른 기기나 브라우저로 옮기려면 화면의 `JSON 내보내기`로 백업한 뒤 `JSON 가져오기`로 불러오면 됩니다.

## 사이트 데이터 예시

```json
{
  "id": "portfolio",
  "name": "Portfolio",
  "description": "개인 포트폴리오 사이트",
  "category": "production",
  "tags": ["portfolio", "public"],
  "url": "https://example.com",
  "adminUrl": "https://example.com/admin",
  "repoUrl": "https://github.com/me/portfolio",
  "docsUrl": "",
  "healthUrl": "https://example.com",
  "imageUrl": "",
  "memo": "배포 전 모바일 화면을 확인합니다."
}
```

## 배포 메모

정적 파일만으로 동작하므로 GitHub Pages, Vercel, Netlify에 쉽게 배포할 수 있습니다. 개인용으로 공개 인터넷에 배포할 경우, 플랫폼의 인증 보호나 별도 로그인 레이어를 붙이는 것을 권장합니다.
