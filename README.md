# MyStudio 홈페이지 (mystudioapps.com)

정적 사이트 — 빌드 과정 없음. GitHub Pages 로 올린다.

- `index.html` 한 장: 오른쪽 앱 아이콘 목록, 누르면 왼쪽에 그 앱 소개(주소 `#앱id`).
  언어 ko/en/ja(오른쪽 위, `?lang=` 로도). 휴대폰(820px 이하)에서는 아이콘 줄이 위로.
- **새 앱 추가**: `index.html` 의 `APPS` 배열에 하나 더 넣고 `assets/<앱id>/` 에 아이콘·스크린샷.
- **출시 후**: `APPS[0].appStore` 에 App Store 주소를 넣으면 버튼이 살아난다.
- **출시 준비 중인 앱**: 스토어 주소가 비어 있으면 '출시 준비 중' 버튼이 되고, 목록의 '다음 앱' 칸을
  그 앱이 대신한다(지금 MyScore). 아이콘이 없으면 `iconText` 글자를 점선 틀에 둔다. 스크린샷(`shots`)이
  비어 있으면 그 칸을 뺀다. 출시 때 아이콘·스크린샷·스토어 주소를 넣으면 '다음 앱' 칸이 돌아온다.
- 바닥글의 방침·약관·문의는 지금 보는 앱의 것을 연다.
- 앱별 약관: `myslowbody/privacy.html`, `myslowbody/terms.html` (store/legal 에서 옮김).
- MyScore 약관: `myscore/privacy.html`, `myscore/terms.html` (7개 언어, `?lang=`). 문구 원본은
  my_score 레포 `tool/legal/gen_legal.py` — 거기서 고쳐 이 폴더로 다시 만든다. 앱이 이 주소를 연다.
- `CNAME` = mystudioapps.com (GitHub Pages 사용자 도메인).

## 올리기(배포)

사이트 저장소: https://github.com/wd2347-gif/mystudioapps (main 브랜치 루트가 GitHub Pages).
이 저장소의 `site/` 를 그쪽 main 으로 밀어 올린다:

    git subtree split --prefix site -b site-publish
    git fetch https://github.com/wd2347-gif/mystudioapps.git main:refs/remotes/site/main
    git checkout site-publish && git merge -s ours --no-edit site/main && git checkout -
    git push https://github.com/wd2347-gif/mystudioapps.git site-publish:main
    git branch -D site-publish

(GitHub 설정 화면에서 도메인을 바꾸면 GitHub 가 그쪽 저장소에 CNAME 커밋을 직접 남긴다 —
`merge -s ours` 로 그 커밋을 이어받되 내용은 site/ 그대로 둔다. 강제 푸시는 쓰지 않는다.)

DNS(가비아): A @ → 185.199.108.153 / .109.153 / .110.153 / .111.153, CNAME www → wd2347-gif.github.io.
