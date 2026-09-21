# MyStudio 홈페이지 (mystudioapps.com)

정적 사이트 — 빌드 과정 없음. GitHub Pages 로 올린다.

- `index.html` 한 장: 오른쪽 앱 아이콘 목록, 누르면 왼쪽에 그 앱 소개(주소 `#앱id`).
  언어 ko/en/ja(오른쪽 위, `?lang=` 로도). 휴대폰(820px 이하)에서는 아이콘 줄이 위로.
- **새 앱 추가**: `index.html` 의 `APPS` 배열에 하나 더 넣고 `assets/<앱id>/` 에 아이콘·스크린샷.
- **출시 후**: `APPS[0].appStore` 에 App Store 주소를 넣으면 버튼이 살아난다.
- 앱별 약관: `myslowbody/privacy.html`, `myslowbody/terms.html` (store/legal 에서 옮김).
- `CNAME` = mystudioapps.com (GitHub Pages 사용자 도메인).

## 올리기(배포)

사이트 저장소: https://github.com/wd2347-gif/mystudioapps (main 브랜치 루트가 GitHub Pages).
이 저장소의 `site/` 를 그쪽 main 으로 밀어 올린다:

    git subtree split --prefix site -b site-publish
    git push https://github.com/wd2347-gif/mystudioapps.git site-publish:main
    git branch -D site-publish

DNS(가비아): A @ → 185.199.108.153 / .109.153 / .110.153 / .111.153, CNAME www → wd2347-gif.github.io.
