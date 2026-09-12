# INVENTORY — 전수 목록

> 이후 모든 검사는 이 목록을 기준으로 진행합니다. (신뢰도: 코드 + 실측)

## 1. 페이지 · 템플릿

| # | 경로 | 종류 | 비고 |
|---|---|---|---|
| P1 | `/` (`index.html`) | 한 장짜리 본 사이트 | 7구역이 한 문서 안에 있음 |
| P2 | `/privacy.html` | 정적 문서 | 푸터에서만 연결 |
| P3 | `/gallery-original/galleries/02-concave-wheel.html` | **iframe 내부 문서** | `#portfolio`가 iframe 으로 불러옴. 직접 접근도 가능 |
| — | `/robots.txt`, `/sitemap.xml` | 텍스트 | 화면 없음 |

직접 열 수 있는 다른 라우트는 없습니다(정적 파일 서버, 빌드 없음).

### 해시 라우트 (`app.js` `destinations`)
`#home` `#drop` `#about` `#portfolio` `#original` `#contact` `#ending`
추가로 `#original/<workId>`(ORIGINAL 상세), `#portfolio/<recordId>`(갤러리 상세).

## 2. P1 섹션 (위 → 아래)

| # | id | 이름 | 높이(1440×900 실측) | 성격 |
|---|---|---|---|---|
| S1 | `#home` | MAIN / 히어로 | 1620px | 기기 키비주얼, 채널 4개, 전원 연출 |
| S2 | `#drop` | DROP (소파 낙하) | 5040px | 스크롤 연동 3D/캔버스 통로. 메뉴 없음 |
| S3 | `#about` | ABOUT | 9540px | 가로 트랙 7칸 + 걷는 캐릭터 |
| S4 | `#portfolio` | RECORDS | 824px | iframe 갤러리 (P3) |
| S5 | `#original` | ORIGINAL / BEAM ARCHIVE | 824px (모바일 2700px) | 탁자 위 네 칸 |
| S6 | `#contact` | CONTACT | 824px | 편지지 문의 양식 |
| S7 | `#ending` | ENDING | 12150px | 거실 장면 + WebGL 게임룸 + 푸터 |

### S3 ABOUT 7칸
`01. 회사소개` · `02. LETTER` · `03. IDENTITY` · `04. HOLOGRAM DISPLAY` · `05. MOTION` · `06. ARCHIVE` · `07. 모든 과정`
(칸 이름표 `data-station`: Company / Letter / Identity / Hologram / Motion / Archive / All processes)

### S5 ORIGINAL 네 칸
`LETTER` · `IDENTITY` · `HOLOGRAM` · `ARCHIVE` (`original-works.js`)

### P3 갤러리 폴더 4개 × 각 11장 = 44장
`Influencer` · `Together` · `Letters` · `Display` (`gallery-original/shared/galleries.mjs` `categories`)

## 3. 컴포넌트와 사용 위치

| 컴포넌트 | 파일 | 사용처 |
|---|---|---|
| 상단 선반 바 + 걷는 마스코트 | `nav-shelf.js` / `nav-shelf.css` | 전역(S1·S7 제외) |
| 히어로 채널 TV | `hero-original.js` / `hero.css` `hero-material.css` | S1 |
| 낙하 통로 | `sofa-journey/*`, `fall-welcome/*`, `journey.js` | S2 |
| ABOUT 가로 트랙 | `journey.js` (카메라) + `about-walk.js` (배경띠·캐릭터) | S3 |
| 골드 칸 | `about-walk.css` `.beam-gold` | S3 (6칸) |
| 갤러리(오목 수레바퀴) | `gallery-original/shared/galleries.mjs` `init02` | P3 |
| 갤러리 브리지 | `portfolio.js` | S4 ↔ P3 |
| 탁자 네 칸 + 상세창 | `originals.js` `original-slots.js` `original-works.js` | S5 |
| 편지지 문의 | `contact-letterbox.js` / `.css` | S6 |
| 엔딩 장면 + 게임룸 | `ending.js` → `ending-scene-r15.js` (three.js) | S7 |
| 움직임 줄이기 토글 | `app.js` `.motion-toggle` | 전역 고정 버튼 |
| 스크롤 힌트 | `scroll-cue.js` / `.css` | S4·S5 하단 |
| 리플레이 커튼 | `app.js` `.replay-curtain` | 전역 |

## 4. 컴포넌트별 상태 (확인 대상)

| 컴포넌트 | 상태 |
|---|---|
| 상단 메뉴 링크 | 기본 / hover / focus-visible / `is-here`(현재 구역) / 바 접힘 |
| 히어로 채널 버튼 | 기본 / hover / `is-selected`(aria-pressed) / focus |
| 편지지 | 닫힘(모바일) / 열림 / 필드 focus / 글자수 경고 / `.bad` 오류 / 동의 미체크 / 보낸 뒤(`sent`) / 다시 쓰기 |
| 개인정보 패널 | 닫힘 / 열림 / ESC 닫기 |
| ORIGINAL 상세창 | 닫힘 / `showModal` / ESC / 뒤로가기 |
| 갤러리 카드 | 기본 / hover / 드래그 중 / 상세 시트 열림 / 폴더 전환 |
| 엔딩 | room / power-off / social / walk / sit / type / approach / home / 렌더러 unavailable |
| 움직임 토글 | aria-pressed false / true |
| 전역 | `prefers-reduced-motion`, JS 비활성(noscript + `.ctl-fallback`) |

## 5. 모션 목록

- **스크롤 라이브러리 없음.** Lenis·Locomotive·GSAP·ScrollSmoother **미사용**(전수 grep 결과 0건).
  스크롤은 **네이티브 + `app.js`의 자체 휠 가로채기(구역 이동)** 입니다.
- `requestAnimationFrame` 루프를 가진 파일: `app.js`, `journey.js`, `about-walk.js`, `nav-shelf.js`,
  `ending.js`, `originals.js`, `scroll-cue.js`, `hero-original.js`, `contact-letterbox.js`,
  `sofa-journey/scene.js`, `sofa-journey/vortex.js`, `gallery-original/shared/{core,galleries}.mjs`
  (그 외 `only-tva-walk.js` `contact.js` `hero-signal.js` `signal-passage.js` `character-direction.js` 는 **미사용 파일**)
- CSS `@keyframes` 개수: `hero.css` 9 · `hero-material.css` 6 · `character-direction.css` 6(미사용) ·
  `ending.css` 4 · `about-walk.css` 3 · `contact-letterbox.css` 3 · `original-table.css` 3 ·
  `scroll-cue.css` 2 · `brand-mark.css` 2 · `nav-shelf.css` 1 · `gallery-original/shared/galleries.css` 14 ·
  `only-tva-walk.css` 15(미사용)
- WebGL: `three.js r154`(`vendor/three.module.js`) — S2 소품 세계(`world-scene.js`), S7 엔딩 장면.
- 배경 영상: `sofa-journey/assets/bg/photo-shaft-fall.{mp4,webm}` (S2)

## 6. 임베드 · 서드파티

| 대상 | 출처 | 비고 |
|---|---|---|
| 갤러리 | 자체 iframe (P3) | `loading="lazy"`, `scrolling="no"`, `tabindex="0"` |
| 웹폰트 | `fonts.googleapis.com` / `fonts.gstatic.com` | Cinzel, Archivo Black, Big Shoulders, IBM Plex Mono, Libre Caslon, Space Grotesk |
| 한글 폰트 | `cdn.jsdelivr.net` (Pretendard v1.3.9 variable dynamic-subset) | |
| 분석·채팅·쿠키 배너 | **없음** | R7 해당 없음 |

## 7. 스크롤 방식과 설정값 원문

- `history.scrollRestoration = 'manual'` (`index.html` 머리글 + `app.js:12` 두 곳)
- `html { scroll-behavior: smooth; scroll-padding-top: var(--nav-height) }` (`styles.css:2`)
- `section { scroll-margin-top: var(--nav-height) }` (`styles.css:2`)
- 자체 휠 가로채기: `app.js` — `handleSectionWheel`, `navigate()`, `sectionWheelLock`,
  `landingOffset()`(`['home','drop','about','ending']`은 0, 나머지는 `nav.offsetHeight`)
- 갤러리(iframe) 안쪽은 자체 휠 처리 + 한 바퀴 후 페이지로 넘김 (`portfolio.js` 162~300행)

## 8. 브레이크포인트 (CSS 에 실제로 있는 값 전부)

`max-width:760px`(45) · `min-width:761px`(12) · `max-width:980px`(8) · `min-width:701px`(7) ·
`max-width:700px`(7) · `max-width: 760px`(5, 공백 표기) · `max-aspect-ratio:5/4`(5) ·
`max-height:560px`(4) · `max-aspect-ratio:1/1`(4) · `min-width: 761px`(3) · `min-aspect-ratio:1/1`(2) ·
`max-aspect-ratio:92/100`(2) · `min-width:981px` · `min-width:801px` · `min-width:600px` ·
`min-height: 900px` · `max-width:900px` · `max-width:800px` · `max-width:699px` · `max-width:600px` ·
`max-width:420px` · `max-width:380px` · `max-width:360px` · `max-width:1050px` · `max-width: 900px` ·
`max-width: 640px` · `max-height:820px` · `max-height:780px` · `max-height:520px` · `max-height: 760px`

→ 가로 경계만 **13종**(`360·380·420·600·640·699·700·760·800·900·980·1050·1280`). 체계 없음 → `#Q01`

## 9. 디자인 토큰

- `styles.css :root` — `--white --paper --ink --muted --line --cobalt --print-blue --deep-blue --cream
  --yellow --kraft --beam-gold --beam-ink --display --condensed --serif --mono --sans --pad
  --nav-height:64px --ease --shadow`
- `nav-shelf.css :root` — `--nav-height:76px` **(같은 토큰을 다른 파일에서 덮어씀)** · `--shelf-body:60px` · `--nav-link-pad:11px`
- `about.css` 안에 `--about-*` 지역 토큰, `about-walk.css` 안에 별도 값
- `--cobalt`(#c8a15e)와 `--beam-gold`(#c8a15e)가 **같은 값 다른 이름**
- `!important` 사용: `only-tva-walk.css` 54(미사용) · `hero.css` 47 · `hero-material.css` 10 ·
  `ending.css` 10 · `styles.css` 6 · `character-direction.css` 5(미사용) · `about.css` 3 · 그 외 3

## 10. 사용하지 않는 파일 (모듈 그래프 밖)

JS: `contact.js` `ending-humans.js` `ending-portal-r16.js` `ending-reader-pose-r28.js`
`ending-scene-r13.js` `ending-scene-r14.js` `ending-scene.js` `hero-signal.js` `index-character.js`
`lusion-tunnel.js` `only-tva-walk.js` `only-tva.js` `portfolio-data.js` `signal-wavefield.js`
CSS: `character-direction.css` `contact.css` `index-character.css` `only-tva-walk.css` `only-tva.css`
그 외: `at-tva-before.png`(771KB 작업 캡처), `tools/`(79MB 빌드 전용)
