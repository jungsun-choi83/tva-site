# ISSUES — 이슈 카드 (유일한 원본)

> 형식은 `audit/PROMPT.md`의 `<issue_format>`를 따릅니다.
> 증거의 `before:`는 수정 전 원본(`f2d8262`, `:18769`), `after:`는 작업 트리(`:18768`)에서 잰 값입니다.
> 신뢰도: `실측` = 브라우저에서 직접 조작·측정 · `코드` = 파일 근거 · `추정` = 간접 근거

---

## P0

### #O01 배포 주소가 전부 자리표시자라 링크 미리보기·검색 등록이 동작하지 않음
- 기기: 공통 | 유형: 결함 | 체크: O2, O3, R5
- 위치: `index.html` 머리글 · `sitemap.xml` · `robots.txt` · `privacy.html`
- 재현: 원본 HTML 을 그대로 읽는 크롤러·메신저 미리보기(자바스크립트 미실행)
- 증거: before `index.html:11` `<link rel="canonical" href="/">`, `og:url`·`og:image` 도 상대 경로.
  절대 주소로 바꾸는 일은 `index.html:31` 인라인 스크립트가 **런타임에** 했다 — 크롤러는 실행하지 않는다.
  `sitemap.xml`·`robots.txt` 는 `https://your-domain.example` 문자열. | 신뢰도: 코드
- 현재(before): `canonical="/"`, `og:image="assets/og/tva-og-1200x630.jpg"`, `Sitemap: https://your-domain.example/sitemap.xml`
- 문제인 이유: 상대 경로 `og:image` 는 대부분의 미리보기 수집기가 해석하지 못해 **카카오톡·슬랙 공유 카드에 이미지가 뜨지 않는다.**
  `your-domain.example` 사이트맵은 검색엔진 등록 자체가 불가능.
- 개선안: 네 파일 모두 `https://device.eternalbeam.com` 절대 주소로 고정하고, 런타임 치환 스크립트는 삭제.
- 확인 기준: `grep -c "your-domain.example"` = 0, `canonical`·`og:url`·`og:image`·`twitter:image`·JSON-LD `url/logo/image` 가 모두 `https://device.eternalbeam.com`로 시작
- 부작용·주의: 도메인이 바뀌면 네 파일을 함께 고쳐야 함 (README 에 명시)
- 관련: — | 우선순위: P0 | 난이도: S
- 상태: 수정됨 | 재측정: `grep -c your-domain.example` → 0 (index/sitemap/robots/privacy), 절대주소 6곳 확인

### #R01 개인정보 처리방침이 실제와 다른 수탁사(Formspree·국외이전)를 고지함
- 기기: 공통 | 유형: 결함 | 체크: R4, L3
- 위치: `privacy.html` 처리위탁 행
- 재현: `/privacy.html` 열기
- 증거: before `privacy.html:51` `<dt>처리 위탁</dt><dd>Formspree Inc.(미국) — 문의 내용 저장·전달(국외 이전)</dd>`.
  실제 전송 경로는 `contact-letterbox.js:4` `const MAIL='jadechoi@eternalbeamapp.com'` + `mailHref()` 의 `mailto:` 뿐이고,
  코드 전체에 `formspree` 문자열은 없다(`grep` 0건). | 신뢰도: 코드
- 현재(before): 존재하지 않는 국외 수탁사를 고지
- 문제인 이유: 사실과 다른 개인정보 고지. 법적 고지가 틀린 채로 배포되면 신뢰·규제 양쪽에서 문제.
- 개선안: 처리 방법을 실제 동작(메일 앱 초안)으로 쓰고 `처리 위탁: 없음` 으로 정정. 편지지 안 안내와 문구 통일.
- 확인 기준: `privacy.html` 과 `contact-letterbox.js` 의 개인정보 안내 문구가 동일하고 Formspree 언급 0건
- 부작용·주의: 실제 접수 백엔드를 붙이면 이 줄을 다시 고쳐야 함(README 에 명시)
- 관련: #L01 | 우선순위: P0 | 난이도: S
- 상태: 수정됨 | 재측정: `grep -c Formspree privacy.html` → 0

### #L01 보내지 않았는데 "편지를 보냈습니다"라고 알림
- 기기: 공통 | 유형: 결함 | 체크: L3, H9, R3
- 위치: `contact-letterbox.js` `markup()` `.posted`
- 재현: CONTACT 에서 이름·이메일·문의·동의를 채우고 SEND
- 증거: before `contact-letterbox.js:70` `<p class="posted">편지를 보냈습니다…`.
  실제 동작은 같은 파일 submit 핸들러의 `a.href = mailHref(...); a.click()` — **방문자 메일 앱에 초안을 띄울 뿐 전송하지 않는다.** | 신뢰도: 코드
- 현재(before): "편지를 보냈습니다"
- 문제인 이유: 메일 앱에서 다시 보내기를 누르지 않으면 문의가 **영영 도착하지 않는데** 보냈다고 안내한다. 유일한 CTA 가 조용히 실패한다.
- 개선안: `contact-letterbox.js` 의 `.posted` 를 `b`(제목)·`span`(설명)·`a`(주소) 3단으로 바꾼다 —
  `"메일 앱에 편지를 담았습니다"` / `"메일 앱에서 보내기를 한 번 더 눌러 주셔야 전달됩니다. 창이 열리지 않았다면 이 주소로 보내 주셔도 됩니다."` /
  `<a href="mailto:…">주소</a>` — 실제로 일어난 일(초안 생성)과 남은 할 일(사용자가 보내기)을 모두 적는다.
- 확인 기준: 완료 화면에 '한 번 더 눌러야 한다'는 안내와 메일 주소가 함께 보일 것
- 부작용·주의: 문구가 길어져 `.posted` 조판을 3단(큰 제목/설명/주소)으로 나눔
- 관련: #R01, #H01 | 우선순위: P0 | 난이도: S
- 상태: 수정됨 | 재측정: `.posted` 가 `<b>`(제목) + `<span>`(안내 2줄) + `<a>`(주소) 3단으로 렌더

### #A01 지어낸 실적 44건이 실제 작업물처럼 올라가 있음
- 기기: 공통 | 유형: 결함 | 체크: A11, L4, R3
- 위치: `gallery-original/shared/galleries.mjs` `init02()` `categories`
- 재현: RECORDS 구역 → 폴더 4개 × 카드 11장, 모바일에서 카드 캡션 확인
- 증거: before `galleries.mjs:396~` `record('brand-01','Beam with Mina','Influencer','2026','01.jpg',…)` 외 43건.
  사진은 `gallery-assets/01~08.jpg` 8장을 돌려 쓴다(44건 중 중복 다수). | 신뢰도: 코드+실측(`m-portfolio.png`에 "Beam with Mina / Influencer" 표시)
- 현재(before): 이름·분야·연도(2024~2026)가 붙은 44건
- 문제인 이유: 확인된 실적이 아닌데 연도까지 붙어 실제 포트폴리오로 읽힌다. 배포 시 허위 표시 위험.
- 개선안: 지어낸 이름 → `SAMPLE 01~11`, 연도 → 빈값(상세창의 Year 줄이 자동으로 사라짐), 화면에 예시 안내 띠 추가.
  잘라내기 좌표(crop)는 손으로 맞춘 값이라 보존.
- 확인 기준: `galleries.mjs` 에 `Beam with Mina` 등 지어낸 제목 0건, 연도 값 0건, `#portfolio` 에 예시 띠가 보일 것
- 부작용·주의: 실제 자료가 들어오면 `index.html` 의 `.portfolio-sample-note` 도 함께 지워야 함
- 관련: — | 우선순위: P0 | 난이도: S
- 상태: 수정됨 | 재측정: `grep -c "Beam with Mina" galleries.mjs` → 0, 카드 캡션 `SAMPLE 01`, 예시 띠 렌더 확인(`m-portfolio.png`)

### #B02 320~390px 에서 CONTACT 메뉴가 잘려 나감
- 기기: 모바일 | 유형: 결함 | 체크: B13, B14, J1, I1
- 위치: `nav-shelf.css` 모바일 블록 + `brand-mark.css` `.eb-mark--nav`
- 재현: 폭 320 / 360 / 390px 에서 RECORDS 구역으로 이동, 상단바 확인
- 증거(before, 실측): 메뉴 오른쪽 끝 vs 선반 안쪽 끝 —
  320: `CONTACT 313~369` / 안쪽끝 304 → **65px 넘침**, 360: `322~379` / 344 → 35px, 390: `336~398` / 374 → 24px.
  `.site-nav{overflow:hidden}` 이라 그만큼 글자가 잘림. | 신뢰도: 실측(`audit/measurements/nav-before.json`)
- 현재(before): 로고 상자 132px 고정(`brand-mark.css:.eb-mark--nav{width:132px}` 가 이겨서 `nav-shelf.css` 의 `img{width:120px}` 가 무력), `nav{padding-left:4%}`, 글자 `clamp(10.5px,3.05vw,12px)`
- 문제인 이유: 유일한 CTA 로 가는 메뉴가 작은 폰에서 읽히지 않는다.
- 개선안: 폭을 **감싸개(.eb-mark)** 에 주고(≤760px 112px, ≤360px 88px), `nav` 왼쪽 여백 4%→8px, 글자 `clamp(9.5px,2.7vw,12px)`·자간 .04em
- 확인 기준: 320/360/390/414px 에서 CONTACT 오른쪽 끝 ≤ 선반 안쪽 끝
- 부작용·주의: 로고가 작아짐(320px 에서 132→88px). 메뉴 가독성이 우선.
- 관련: #H02 | 우선순위: P0 | 난이도: S
- 상태: 수정됨 | 재측정: 320: `254~303` / 304 ✅ · 360: `289~343` / 344 ✅ · 390: `316~370` / 374 ✅ · 414: `335~392` / 398 ✅

---

## P1

### #N01 첫 화면 PNG(739KB)를 서로 다른 `?v=` 로 최대 3번 내려받음
- 기기: 공통 | 유형: 결함 | 체크: N3, N7, K3
- 위치: `index.html:41`(preload), `index.html:87`(히어로 img), `index.html:262`(엔딩), `ending-scene-r15.js:488`(three.js 텍스처)
- 재현: 네트워크 탭에서 `beam-device-1920x1080.png` 요청 수 확인
- 증거: before — preload `?v=eternal-beam-r29`, 실제 히어로 `?v=eternal-beam-r31`, 엔딩 `?v=eternal-beam-r29`, 텍스처는 쿼리 없음.
  URL 이 다르면 브라우저 캐시가 공유되지 않는다. | 신뢰도: 코드
- 현재(before): 같은 739KB 파일에 대해 최대 3개의 서로 다른 URL
- 문제인 이유: LCP 이미지를 preload 해 놓고 **실제로는 다른 URL 을 다시 받는다** — preload 가 통째로 낭비되고 첫 화면이 늦어진다.
- 개선안: 네 곳의 `?v=` 를 하나로 통일(`eternal-beam-r31`)
- 확인 기준: 첫 로드 네트워크에서 `beam-device-1920x1080.png` 요청 1건
- 부작용·주의: 없음
- 관련: #N02 | 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정: 네 곳 모두 `?v=eternal-beam-r31` 로 통일. 첫 로드 네트워크에서 `beam-device-1920x1080.png` **2회 → 1회**
  (`scratchpad/netcheck.mjs`: before 목록에 `2 회 /assets/hero/beam-device-1920x1080.png`, after 목록에서 사라짐).
  같은 패스에서 `idle.png`(4종 URL)·`sit.png`(3종)·`walk1.png`(3종)·`table-clean-1671.webp`(2종)·파비콘 3장도 통일 — **중복 URL 0건**

### #H02 현재 보고 있는 메뉴의 글자를 지워 메뉴가 3개로 보임
- 기기: 공통 | 유형: UX 문제 | 체크: I1, M10, H1
- 위치: `nav-shelf.css` `.site-nav nav a.is-here{color:transparent}`, `nav-shelf.js` `targetX()`
- 재현: ABOUT 아래 아무 구역으로 이동해 상단바를 본다
- 증거(before, 실측): RECORDS 구역에서 상단바가 `ABOUT · (빈칸+캐릭터) · ORIGINAL · CONTACT` 로 보임.
  `nav-shelf.css` 주석 "지금 보고 있는 구역은 글자를 비우고 캐릭터가 그 자리에 선다" = 의도된 동작이지만
  캐릭터 상자(1440px 에서 66×66)가 메뉴 글자(85px)를 덮어 이름이 사라진다.
  스크린샷 `audit/screenshots/before/chromium/1440/home/` 중 RECORDS 구간 | 신뢰도: 실측+코드
- 현재(before): `color:transparent` + 캐릭터가 메뉴 **한가운데**(centers[i])에 정지
- 문제인 이유: 현재 위치 표시가 '이름이 사라지는' 방식이라, 처음 온 사람은 메뉴가 세 개라고 읽는다. 마우스를 올려야 이름이 돌아온다.
- 개선안: 글자는 그대로 두고 `.is-here` 에 금색 밑줄(파일에 이미 있던 reduced-motion 표시와 동일). 캐릭터는 이름 **옆 빈칸**으로 보내고,
  빈칸이 좁으면 그 칸에 맞게 축소(최소 58%), 그래도 좁으면 선반 밖에서 대기.
- 확인 기준: 네 구역 모두에서 메뉴 네 개의 글자가 모두 보이고, 캐릭터 상자가 어떤 메뉴 글자 상자와도 겹치지 않을 것
- 부작용·주의: 모바일(≤414px)은 메뉴 사이 빈칸이 6~10px 뿐이라 캐릭터가 선반 밖에서 대기한다(파일에 이미 있던 규칙 재사용)
- 관련: #B02 | 우선순위: P1 | 난이도: M
- 상태: 수정됨 | 재측정: 1440 캐릭터 `799~865` = RECORDS(738)와 ORIGINAL(926) 글자 사이 빈칸. 768 은 55px 빈칸에 맞춰 축소. 320~414 는 선반 밖.

### #B04 ABOUT 골드 칸 본문을 캐릭터가 덮어 글자가 안 읽힘
- 기기: 공통(모바일 심각) | 유형: 결함 | 체크: B14, G6, M10
- 위치: `about.css` `.studio-track{z-index:3}` vs `.studio-host{z-index:8}`, `about-walk.css` `.beam-gold{left:42.8%}`
- 재현: ABOUT 에서 각 골드 칸에 정지
- 증거: before 390×844 HOLOGRAM 칸 — 캐릭터(`x183~320,y638~775`)가 골드 칸(`x16~374,y490~810`) 한가운데.
  "…안에서 겹쳐" "…속에 머무는" 두 줄이 가려짐(`audit/screenshots/before` 390 ABOUT 구간).
  1440 에서는 내민 팔이 `PHILOSOPHY / 필로소피` 머리글을 덮음. | 신뢰도: 실측
- 현재(before): 칸 글(`.beam-gold` z-index 10)은 `.studio-track`(3) 안에 있고, 캐릭터는 트랙 **밖** z-index 8 → 항상 캐릭터가 위
- 문제인 이유: 본문이 읽히지 않는다. 장식(aria-hidden)이 내용을 가린다.
- 개선안: ① 데스크톱 — 칸을 `left:42.8%→46%` 로 물려 내민 팔이 글에 닿지 않게. 캐릭터 x 는 5·6번 칸 전경 테이블과 맞춘 값이라 건드리지 않음.
  ② 모바일(≤760px) — 칸이 화면 폭을 다 쓰고 캐릭터 서는 높이가 칸 한가운데라 둘을 같은 자리에 넣을 여백이 없음 → ABOUT 의 걷는 캐릭터만 비표시.
- 확인 기준: 모든 골드 칸에서 `.beam-gold` 안 텍스트 상자와 `.studio-host` 상자가 겹치지 않을 것
- 부작용·주의: **시도 1 기각** — `.studio-track` z-index 를 11 로 올려 글을 위로 보냈더니, 칸의 불투명한 바탕
  (`linear-gradient(#fff 0 50%, #f3eee4 50% 100%)`)이 캐릭터를 통째로 지웠다. 바탕을 카메라로 내려 봤더니 이번엔
  그 아래 `about-walk__strip`(z-index 1) 사진 띠가 드러나 화면이 깨졌다(검은 블록). 둘 다 되돌리고 위 방법으로 감.
  모바일에서 ABOUT 캐릭터가 사라지는 것은 감수한 트레이드오프(데스크톱과 다른 구역에는 그대로 나옴).
- 관련: #C02 | 우선순위: P1 | 난이도: M
- 상태: 수정됨 | 재측정: 1440 `필로소피` 전체 노출, 390 HOLOGRAM 칸 본문 4줄 모두 노출

### #C02 ABOUT 골드 칸이 제 글을 잘라먹음 (노트북 높이 전부)
- 기기: 데스크톱 | 유형: 결함 | 체크: C14, B14, B11
- 위치: `about-walk.css` `.beam-gold{top:50%;bottom:16%;overflow:hidden;justify-content:center}`
- 재현: 1280×720 / 1366×768 / 1440×900 / 1024×768 에서 ABOUT 1번 칸(PHILOSOPHY)
- 증거(실측, before=after 동일): `scrollHeight - clientHeight` = 1280×720 **47px** · 1440×900 **26px** · 1024×768 **24px** · 1920×1080 0px.
  1280×720 크롭(`scratchpad/gold-1280.png`): 영문 머리글 `PHILOSOPHY` 가 **통째로 사라지고** `필로소피` 는 위가 잘림,
  마지막 줄 `우리는 함께한 시간을 간직하고 이어가는 방식을 만듭니다.` 는 아래가 반쯤 잘림.
  첫 자식 상단 `419.7px` < 칸 상단 `436px` 로 수치로도 확인. | 신뢰도: 실측
- 현재: 칸 높이가 `top:50% ~ bottom:16%`(카메라 높이의 34%)로 고정 + `overflow:hidden` + `justify-content:center`
  → 내용이 더 크면 **위아래 양쪽이 조용히 잘린다**
- 문제인 이유: 회사 철학 문단의 첫 줄과 마지막 줄이 흔한 노트북 해상도에서 사라진다. 스크롤도 안 되므로 복구 수단이 없다.
- 개선안: 화면이 낮을 때(`@media (min-width:761px) and (max-height:920px)`) 칸 내부 여백·행간·글자 크기를 줄여 내용이 들어가게 한다.
  (칸의 `top:50%` 는 배경 그라디언트 이음새라 건드리지 않는다)
- 확인 기준: 1024×768 · 1280×650 · 1280×720 · 1366×768 · 1440×900 · 1920×1080 에서 모든 `.beam-gold` 의 `scrollHeight - clientHeight` = 0
- 부작용·주의: 낮은 화면에서 본문 글자가 작아짐. 잘리는 것보다 낫다.
- 관련: #B04 | 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정: `.beam-gold` 의 `scrollHeight - clientHeight` —
  1024×768 24→**0** · 1280×650 59→**0** · 1280×720 47→**0** · 1366×768 44→**0** · 1440×900 26→**0** · 1536×864 35→**0** · 1920×1080 0 · 2560×1440 0
  (`scratchpad/goldfit2.mjs`, 화면 높이 920/790/690px 세 단계로 여백·행간만 줄임)

### #I01 ABOUT 칸 이름표가 옛 기획의 이름을 읽음
- 기기: 공통 | 유형: 결함 | 체크: I1, L3, M15
- 위치: `index.html` `data-station` 속성, `journey.js:526`
- 재현: ABOUT 하단 이름표(`.studio-stop-label`, `role=status aria-live=polite`) 관찰
- 증거: before `data-station="Company|Planning|Spatial|Creative|Product|Operating|Our work"` —
  화면의 칸 이름은 `회사소개·LETTER·IDENTITY·HOLOGRAM DISPLAY·MOTION·ARCHIVE·모든 과정`.
  `journey.js:526` `stopLabel.textContent = stations[current].dataset.station` | 신뢰도: 코드+실측(`d-about-0.png` 이름표 "COMPANY")
- 현재(before): 옛 TVA 스튜디오 기획의 칸 이름
- 문제인 이유: 화면에 보이는 칸 제목과 이름표가 다르다. `aria-live` 라서 화면낭독기도 틀린 이름을 읽는다.
- 개선안: `Company / Letter / Identity / Hologram / Motion / Archive / All processes`
- 확인 기준: 7칸 이동 시 이름표가 각 칸 제목과 일치
- 부작용·주의: 없음
- 관련: #B01 | 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정: HOLOGRAM 칸에서 이름표 "HOLOGRAM"(`m-about-2.png`), ARCHIVE 칸에서 "ARCHIVE"(`d-about-5.png`)

### #B03 ORIGINAL 휴대폰 제목이 빈 네모로 나오고 진짜 글자는 숨겨져 있음
- 기기: 모바일 | 유형: 결함 | 체크: B14, K1, M3
- 위치: `originals.js` `ensureMobileOriginalScene()`, `original-table.css` `.original-table__mobile-titlemark`
- 재현: 390px 에서 ORIGINAL 구역 상단
- 증거: before — `originals.js` 가 `<svg viewBox="1360 100 310 230">` 로 `table-clean-1671.webp` 의 오른쪽 위를 오려
  제목 마크로 쓰고, 진짜 `<span>BEAM ARCHIVE</span>` 에는 `original-table__accessible`(시각적 숨김)을 붙였다.
  그 마크는 옛 `TVA ORIGINAL` 로고이고 Eternal Beam 그림(`table-clean` r3)에는 없어서 **빈 베이지 네모**만 남는다.
  실측: 그 svg 상자 `[20,-3,128,94]` 가 CONTACT 구역 위로 27px 삐져나와 `CONTACT` 제목까지 덮음. | 신뢰도: 실측+코드
- 현재(before): 제목 자리에 정체 모를 네모, 다음 구역 위로 넘침
- 문제인 이유: 구역 제목이 없다. 게다가 다음 구역 화면을 덮는다.
- 개선안: SVG 오려내기 삭제, `<span>BEAM ARCHIVE</span>` 를 그대로 표시(`var(--display)` 24px)
- 확인 기준: 390px ORIGINAL 상단에 `BEAM ARCHIVE` 글자가 보이고, CONTACT 상단에 잔상 없음
- 부작용·주의: 없음(오려내던 원본 그림은 그대로 둠)
- 관련: — | 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정: `m-original.png` 에 `BEAM ARCHIVE` 표시, `m-contact.png` 상단 잔상 사라짐

### #N02 22MB 배경 영상을 `preload="auto"` 로 먼저 받음
- 기기: 공통(모바일 심각) | 유형: 결함 | 체크: N6, N12, J39, J40, K10
- 위치: `sofa-journey/scene.js:92~93`
- 재현: 첫 로드 네트워크 관찰
- 증거: `photo-shaft-fall.mp4` **22,059,282 B(21MB)**, `.webm` 10,316,143 B(9.8MB), 포스터 `photo-shaft.jpg` 281KB.
  `<video ... preload="auto">` 이고 `<source src=mp4>` 가 **webm 보다 먼저** 있어 Chrome/Safari 는 21MB 쪽을 고른다. | 신뢰도: 코드+파일크기 실측
- 현재: `preload="auto"`, mp4 우선
- 문제인 이유: 4G 에서 21MB 는 첫 화면 이후 대역을 통째로 먹는다. `#drop` 은 첫 화면 바로 다음이라 회피할 수도 없다.
- 개선안: `preload="metadata"` 로 낮추고 `<source>` 순서를 webm 우선으로(지원 브라우저는 절반 용량), 포스터는 유지
- 확인 기준: 첫 로드에서 영상 전송량이 눈에 띄게 줄고(포스터만), `#drop` 진입 시 재생 시작
- 부작용·주의: 느린 회선에서 낙하 영상 시작이 최대 1~2초 늦어질 수 있음 → 포스터(`photo-shaft.jpg`)가 그 자리를 덮고 있어 검은 화면은 없음.
  **`preload="metadata"` 만으로는 소용이 없었다** — `sofa-journey/scene.js` 의 `draw()` 가 첫 화면에서 이미 `hxVid.play()` 를 불러
  브라우저가 전체를 받고 있었다. 재생 조건에 `mount.classList.contains('is-live')`(IntersectionObserver, 화면 앞뒤 60%)를 추가해 해결.
- **단계 9 재감사에서 이 수정의 허점 두 개를 더 찾아 고쳤습니다.**
  1. **통로 한가운데에 서 있으면 영상이 첫 프레임에 멈춰 있었다.** `is-live` 를 붙이는 IntersectionObserver 가
     `draw()` 보다 늦게 불리면 재생 판단이 '다음 스크롤'까지 미뤄졌다(실측: y=1400 에 멈춰 2.2초 뒤에도 `paused·t=0`).
     → 관찰자가 켜질 때 `wake()` 로 한 번 다시 그린다.
  2. **재생 판단을 `is-live` 로 하면 안 된다.** `is-live` 는 합성 레이어를 미리 올리려고 앞뒤 60% 를 더 보기 때문에
     **첫 화면(y=0)에서 이미 켜져 있다.** 여기에 1번을 더하자 10MB 영상이 첫 로드로 되돌아왔다(실측으로 확인).
     → `rootMargin:0` 짜리 관찰자(`videoOn`)를 따로 두어 '진짜로 화면에 걸쳐 있을 때'만 재생한다.
  3. `preload="metadata"` 도 낮췄다 → **`preload="none"`**. Range 요청을 지원하지 않는 서버에서는
     metadata 요청이 파일 전체를 끌어온다(이 감사의 로컬 서버가 그렇다: content-length 합 76.79MB 중 10MB 가 영상).
     포스터(`photo-shaft.jpg`)가 첫 프레임 자리를 덮고 있어 검은 화면은 생기지 않는다.
- 관련: #N01 #N05 #N08 | 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정(`audit/scripts/payload.mjs`, 첫 로드 후 9초 정지):
  **transferSize 합 55.76MB → 39.21MB(−16.55MB, −29.7%)**, 요청 134 → 122건.
  `photo-shaft-fall.*` 는 **첫 로드 목록에서 사라짐**(before 1위 10,075KB). 영상은 `#drop` 에 들어서면 돈다 —
  y=1400 에서 2.2초 뒤 `paused:false · t=1.85`, y=3000 에서 `t=4.06`(실측)

---

## P2

### #B01 ABOUT 칸 번호가 02 에서 두 번 나오고 07 이 없음
- 기기: 공통 | 유형: 결함 | 체크: L3, I1, B18
- 위치: `index.html` `.about-sr-summary` 목록 + 7개 `.eyebrow`
- 증거: before `01. 회사소개 · 02. LETTER · **02. IDENTITY** · 03. HOLOGRAM DISPLAY · 04. MOTION · 05. ARCHIVE · **06 / 모든 과정**`
  — 칸은 7개인데 번호는 01~06, 02 가 둘. 마지막 칸만 구분자가 `/`. | 신뢰도: 코드
- 개선안: `01~07` 로 다시 매기고 구분자를 `.` 로 통일
- 확인 기준: `.eyebrow` 7개가 `01.~07.` 로 중복 없이 증가
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `01. 회사소개 / 02. LETTER / 03. IDENTITY / 04. HOLOGRAM DISPLAY / 05. MOTION / 06. ARCHIVE / 07. 모든 과정`

### #L02 오류 문구의 조사가 `을(를)` 로 나옴
- 기기: 공통 | 유형: 결함 | 체크: L3, H9
- 위치: `contact-letterbox.js` submit 핸들러
- 증거: before `msg = missing.join(', ') + '을(를) 채워 주세요'`, 또 `email ? '올바른 이메일' : '이메일'` 이라
  `올바른 이메일을(를) 채워 주세요` 처럼 어색한 문장이 나온다. | 신뢰도: 코드
- 개선안: 받침으로 `을/를` 을 고르는 `objectParticle()` 추가, 이메일 형식 오류는 별도 문장(`이메일 주소를 다시 확인해 주세요`)으로 분리,
  존댓말을 `~해 주세요` 로 통일(`개인정보 동의가 필요해요` → `개인정보 수집·이용에 동의해 주세요`)
- 확인 기준: `이름을`, `문의 내용을`, `연락처를` 처럼 받침에 맞는 조사가 나올 것
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `objectParticle` 단위 확인 — 이름을/이메일을/문의 내용을/연락처를/주소를/메모를

### #L03 자바스크립트가 꺼졌을 때 "Java(자바)는 필요 없습니다"
- 기기: 공통 | 유형: 결함 | 체크: L3, S4
- 위치: `index.html` `#contact-mount` 안 `.ctl-fallback`
- 증거: before `<p>문의는 아래 칸에 적어 보내시면 됩니다. Java(자바)는 필요 없습니다.</p>` — Java 와 JavaScript 를 혼동한 문장 | 신뢰도: 코드
- 개선안: 문장 교체 + `<noscript>` 안내도 옛 이름(스튜디오)에서 Eternal Beam 으로
- 확인 기준: `grep -c "Java(자바)"` = 0
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `grep -ro "Java(자바)"` = **0건**(html·js 전체). `<noscript>` 문구도 "스튜디오" → Eternal Beam 으로 교체 확인

### #H01 자바스크립트가 꺼지면 문의 폼이 눌러도 아무 일도 안 일어남
- 기기: 공통 | 유형: 결함 | 체크: S4, H9, H13
- 위치: `index.html` `.ctl-fallback-form`
- 증거: before `<form action="mailto:jadechoi@…" method="POST" enctype="text/plain">`.
  `mailto:` 로의 form 제출은 브라우저마다 동작이 다르고 Chrome 계열에서는 아무 반응이 없는 경우가 있다.
  게다가 이 폼에는 CSS 가 하나도 없다(`styles.css` 에 `.ctl-fallback-form` 규칙 0건). | 신뢰도: 코드
- 개선안: 폼 삭제하고 제목이 붙은 `mailto:` 링크 한 줄로 교체(+`.ctl-fallback-hint a` 스타일 추가)
- 확인 기준: JS 차단 상태에서 CONTACT 에 읽을 수 있는 메일 주소 링크가 보일 것
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `nojs.json`(자바스크립트 차단): `문의대체문구 true` · `메일주소보임 true` · `mailto링크수 1` · `폼남아있나 0` · `ABOUT본문보임 true`

### #I02 히어로 CH 03 이 설명과 다른 구역으로 보냄
- 기기: 공통 | 유형: UX 문제 | 체크: I1, L6
- 위치: `index.html` 히어로 채널, `hero-original.js:4`
- 증거: 채널 이름 `ARCHIVE`, 본문 `FOUR WAYS TO KEEP / Letter, stamp, NFC card and the Beam itself`,
  색인 `LETTER / STAMP / CARD / DEVICE` — 네 갈래 이야기인데 `data-hero-target="portfolio"`(사진 갤러리)로 보냈다.
  네 갈래가 실제로 놓인 곳은 `#original`(BEAM ARCHIVE 탁자). | 신뢰도: 코드
- 개선안: `data-hero-target="original"`
- 확인 기준: CH 03 을 누르면 `#original` 로 이동
- 부작용·주의: 히어로에서 RECORDS 로 가는 바로가기가 없어짐(상단 메뉴로 접근 가능)
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `index.html` 의 `data-hero-target` 네 값 = `home · about · original · contact` — CH 03 이 `original`(BEAM ARCHIVE)로 간다

### #M01 엔딩의 화면낭독기 설명과 오류 안내가 영어
- 기기: 공통 | 유형: 결함 | 체크: M13, M3, L3
- 위치: `index.html` `.ending-description` 2개 · `.ending-fallback`, `ending.js:42,52`
- 증거: before `Keep the memory.` / `Scroll to switch off the beam. Goya and his owner sit together with the app and the cube keeps a Shiba hologram.`
  (`ending.css:83` 로 시각적 숨김 = 화면낭독기 전용) 와 화면에 실제로 보이는 `The game room is unavailable here…`.
  문서는 `lang="ko"` 라 한국어 음성엔진이 영어를 한글 음가로 읽는다. | 신뢰도: 코드
- 개선안: 세 곳 모두 한국어로 — `index.html` 의 `.ending-description` 2개와 `.ending-fallback` 1개,
  `ending.js` 의 상태 문구 2개(`'마지막 장면을 준비하고 있습니다…'` / `'이 브라우저에서는 마지막 장면을 띄울 수 없습니다…'`).
  오류 안내는 화면에 그대로 보이므로 특히 한국어여야 한다.
- 확인 기준: `.ending-description`·`.ending-fallback`·`ending.js` 상태 문구에 영어 문장 0건
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `ending-fallback.json` 대체 문구 = "이 브라우저에서는 마지막 장면을 띄울 수 없습니다. Back to home 을 누르면 처음 화면으로 돌아갑니다." (한국어), `.ending-description` 2곳도 한국어

### #K01 파비콘의 `type` 이 실제 형식과 다름
- 기기: 공통 | 유형: 결함 | 체크: K9
- 위치: `index.html:28`, `privacy.html:10`
- 증거: `<link rel="icon" type="image/png" … href="assets/favicon/favicon-32.webp">` — 파일은 WebP | 신뢰도: 코드
- 개선안: `type="image/webp"`
- 확인 기준: 선언 형식 = 실제 형식
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `<link rel="icon" type="image/webp" … favicon-32.webp>` — 선언 형식 = 실제 형식. `qa-check.mjs` 도 0건

### #K02 브랜드 마크의 `width/height` 가 실제 비율과 다름 (레이아웃 흔들림)
- 기기: 공통 | 유형: 결함 | 체크: K4, N4
- 위치: `index.html:71`(`1400×180`), `index.html:94`(`720×90`)
- 증거: `assets/brand/eternal-beam-mark.png` 실제 **1400×99**.
  선언 비율 7.78:1 · 8:1 vs 실제 14.14:1 → 로드 전 상자가 실제보다 1.8배 높게 잡혔다가 줄어든다. | 신뢰도: 실측(파일 헤더)
- 개선안: 두 곳 모두 실제 비율로(`1400×99`, `720×51`)
- 확인 기준: 선언 비율과 실제 비율의 차 ≤ 2%
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `1400×99`·`720×51` 로 교체 — `index.html` 의 12개 `<img>` 전부 선언 비율 = 실제 비율

### #L04 문서와 실제 사이트가 서로 다른 사이트를 설명함
- 기기: 공통 | 유형: 결함 | 체크: L3, L9, Q7
- 위치: `README.md`, `읽어주세요.md`, `robots.txt` 주석
- 증거: before `README.md` 첫 줄 `# TVA studio`, 실행 경로 `/Users/mac/Documents/Codex/…`,
  없는 `qa/` 폴더의 검증 명령, `ONLY TVA` 구역(현재 없음) 언급. `robots.txt` 첫 줄 `# TVA — Tomorrow's Value Atelier`. | 신뢰도: 코드
- 개선안: 실제 구조(7구역·도메인·예시 자료·배포 제외 목록)에 맞게 다시 씀
- 확인 기준: 문서의 구역 목록·명령·경로가 실제와 일치
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `grep -ic "tomorrow.s value|TVA studio" README.md 읽어주세요.md` = **0건 · 0건**

---

## P3

### #Q01 브레이크포인트가 13종으로 흩어져 있음
- 기기: 공통 | 유형: 디자인 개선 | 체크: Q1, Q6, B15
- 위치: CSS 전역
- 증거: 가로 경계 `360·380·420·600·640·699·700·760·800·900·980·1050·1280`,
  같은 값도 `max-width:760px`(45회) / `max-width: 760px`(5회) 두 표기 | 신뢰도: 코드
- 개선안: 토큰화 제안만(모드 B 는 수정 대상 아님) — `REPORT.md` §13 에 수치로 정리했다:
  글꼴 조합 61 → 7단계 타입 스케일, 간격 38 → 4px 배수 8단계, 색 26 → 9개 이름, z-index 24 → 6층.
- 보류 사유: 브레이크포인트 13종을 하나로 모으면 79개 미디어쿼리 블록이 전부 움직인다. 이번 패스의 P0·P1 수정과 같은 커밋에 섞으면 회귀 원인을 분리할 수 없어 다음 작업으로 미룬다.
- 우선순위: P3 | 난이도: L
- 상태: 보류

### #Q02 같은 토큰(`--nav-height`)을 두 파일이 다른 값으로 정의
- 기기: 공통 | 유형: 디자인 개선 | 체크: Q1, Q3
- 위치: `styles.css:1`(`64px`) vs `nav-shelf.css:2`(`76px`)
- 증거: 둘 다 `:root` 에 선언. 로드 순서상 `nav-shelf.css` 가 이긴다. `scroll-padding-top`·`scroll-margin-top`·
  `landingOffset()` 이 모두 이 값을 쓰므로 착지 위치가 여기에 걸려 있다. | 신뢰도: 코드
- 개선안: 한 곳(`styles.css`)에서만 정의 — 제안만
- 보류 사유: z-index 체계를 다시 세우려면 24개 값이 걸린 구역 전체를 동시에 손봐야 한다. 이번 패스에서 실제로 그 때문에 사고가 났고(#B04 시도 1) 되돌렸다 — 단독 작업으로 분리한다.
- 우선순위: P3 | 난이도: S
- 상태: 보류

---

## 추가 발견 (패스 1·3·5, 체크리스트 외 포함)

> 아래 다섯 건(#N08·#N09·#H14·#M04·#I06)은 **단계 9 재감사에서 새로 나온 것**입니다.
> #N08 에는 이번 수정 작업이 스스로 만든 회귀가 하나 들어 있습니다 — 감춘 것이 아니라 그대로 적습니다.

### #N08 같은 그림·같은 모듈을 서로 다른 `?v=` 로 두 번 이상 내려받음 (실행 중 실측)
- 기기: 공통 | 유형: 결함 | 체크: N1, N8, Q5, **체크리스트 외 발견**
- 위치: `journey.js:13~21` · `character-rig.js:3~6` · `about-walk.js:48` · `sofa-journey/scene.js:60`
- 재현: 1440×900 으로 `/` 를 열고 문서 끝까지 내린 뒤, 같은 경로에 대한 요청의 질의문자열을 모은다
  (`node audit/scripts/verify2.mjs <라벨> <주소>` 의 `중복주소`)
- 증거(실측): before 8개 파일이 여러 주소로 요청됨 — `assets/goya/idle.png` 가 **5가지**(`r29·r18·r51·r98·r14`),
  `sit.png` 4가지, `walk1.png`·`walk2.png` 각 2가지, `character-rig.js` 2가지, `fall-welcome/actor.js` 2가지,
  `brand-mark.css` 2가지, `beam-device-1920x1080.png` 3가지. 총 요청 155건 | 신뢰도: 실측(`verify2-before.json`)
- 현재(before): 같은 1.0~1.8MB PNG 를 브라우저가 서로 다른 자원으로 보고 각각 받는다.
  ES 모듈은 더 나쁘다 — `character-rig.js` 와 `fall-welcome/actor.js` 는 **모듈 인스턴스가 두 벌** 올라간다.
- 원인: 세 가지가 섞여 있었다.
  1. `about-walk.js:48` 이 `new URL(import.meta.url).searchParams.get('v')` 로 **자기 모듈의 판 번호**를 캐릭터 그림에 찍었다(→ r98).
  2. `sofa-journey/scene.js:60` 이 같은 방식으로 `brand-mark.css` 에 자기 판 번호를 찍었다.
  3. `character-rig.js:4,6` 이 r51 주소를 만들어 놓고 `searchParams.set('v','eternal-beam-r18')` 로 덮어썼다.
  - **그리고 이번 감사의 앞 작업(#N01)이 만든 회귀**: `journey.js` 의 `?v=${GOYA_V}` 를 문자열로 치환하다
    `?v=eternal-beam-r51${GOYA_V}` 가 되어 `?v=eternal-beam-r51eternal-beam-r51` 이라는 없는 판 번호로 6곳이 요청됐다.
- 개선안: 캐릭터 그림의 판 번호를 `journey.js` 의 `GOYA_V = 'eternal-beam-r51'` 하나로 모으고,
  모듈 판 번호를 자산에 찍던 두 곳을 고정값으로 바꾼다. `character-rig.js` 의 덮어쓰기 두 줄은 삭제.
  `brand-mark.css` 는 `index.html` 과 같은 `?v=eternal-beam-r29`.
- 확인 기준: `verify2` 의 `중복주소` = 0건, `qa-check.mjs [2]` = 0건
- 부작용·주의: 판 번호가 바뀌므로 배포 직후 한 번은 다시 받는다(그 뒤부터 한 벌만).
- 관련: #N01, #N09 | 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정: `verify2-after2.json` 중복주소 0건 · `qa-check.mjs` 확인 권장 0건

### #N09 내용이 바뀐 CSS·JS 의 `?v=` 가 그대로라 배포해도 옛 파일이 캐시에서 나온다
- 기기: 공통 | 유형: 결함 | 체크: N8, O8, **체크리스트 외 발견**
- 위치: `index.html` 스타일시트 7줄 · `app.js` 5줄 · `originals.js` 2줄 · `ending.js` · `journey.js` · `signal-passage.js` 등
- 재현: 이번 감사에서 고친 파일 목록(`git diff --name-only f2d8262`)과 그 파일을 부르는 주소의 `?v=` 를 대조
- 증거(1차·2차 커밋 직후 기준): 그때까지 고친 파일 20개 가운데 **12개가 옛 판 번호 그대로**였다 —
  `styles.css?v=eternal-beam-r63`, `nav-shelf.css?v=eternal-beam-r29`, `ending.css?v=eternal-beam-r98`,
  `contact-letterbox.css?v=eternal-beam-r67`, `about-walk.css?v=eternal-beam-r98`, `portfolio.css`, `original-table.css`,
  `contact-letterbox.js`, `ending.js`, `journey.js`, `nav-shelf.js`, `originals.js` | 신뢰도: 코드
- 현재(before): 이미 방문한 적 있는 사람은 배포 뒤에도 **고치기 전 CSS·JS 를 그대로 받는다**.
  이번 수정의 핵심(메뉴 잘림·거짓 완료 안내·캐릭터 겹침)이 그 사람에게는 반영되지 않는다.
- 개선안: 내용이 바뀐 파일만 `?v=eb-20260912` 로 올린다. 같은 파일을 부르는 **모든 곳**을 함께 바꾼다.
- 확인 기준: 바뀐 파일의 참조가 모두 `?v=eb-20260912`, `qa-check.mjs [2]` 0건
- 부작용·주의: 다음 배포 때도 같은 일을 해야 한다 → `README.md` 배포 절차에 명시.
- 관련: #N08, #N07 | 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정: 참조 **28곳** 치환(`grep -ro 'v=eb-20260912'` = 28), `qa-check.mjs` 확인 권장 0건,
  `verify2-final.json` 중복주소 0건

### #H14 휴대폰에서 상단바 캐릭터가 화면 밖에 선 채로 계속 그려짐
- 기기: 모바일 | 유형: 결함 | 체크: H12, N5, J19, **체크리스트 외 발견**
- 위치: `nav-shelf.js` `targetX()`·`restX()` 의 `return navW + w`
- 재현: 폭 320~480 에서 RECORDS 구역까지 내려 상단바를 띄운 뒤 `.nav-mascot` 의 위치를 잰다
- 증거(실측, `verify2-after.json`): 그림이 320에서 `359~387`, 390에서 `429~457`, 480에서 `519~547` —
  **모두 화면 오른쪽 밖**(`화면밖: true`). 560 이상에서만 화면 안에 선다.
  그런데도 `display:block` 이라 포즈 그림(1.0MB)을 받고 `requestIdleCallback` 이 나머지 4장(약 4.5MB)을 더 받았다 | 신뢰도: 실측
- 현재(before-of-this-fix): 보이지 않는 그림을 위해 휴대폰이 최대 5.5MB 를 받고 rAF 루프도 돈다.
  (원본 `f2d8262` 에서는 캐릭터가 화면 안에 있었지만 **현재 메뉴 이름을 덮고** 있었다 — #H02·#B02 참고)
- 개선안: 빈칸을 못 찾으면 `noRoom` 을 세워 `.nav-mascot.is-noroom{display:none}` 으로 감추고,
  그리지도 않는다. 나머지 포즈 미리 받기는 **캐릭터가 실제로 한 번 선 뒤**에만 한다.
- 확인 기준: 320~480 에서 `.nav-mascot` 의 `display` = `none`, 560 이상에서 `block` 이고 글자와 겹치지 않음
- 부작용·주의: 휴대폰 상단바에서는 캐릭터가 보이지 않는다. 폭이 좁아 캐릭터가 설 빈칸이 최대 12px
  (캐릭터 최소 폭 31px)뿐이라 겹치지 않고 세울 방법이 없다 — ABOUT 골드 칸에서 내린 판단(#B04)과 같은 결론이다.
- 관련: #B02, #H02, #B04, #N05 | 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `verify2-after2.json` 상단바 표

### #M04 키보드만으로는 첫 화면에서 메뉴에 닿을 수 없다
- 기기: 데스크톱(키보드) | 유형: UX 문제 | 체크: M5, M6, E1, **체크리스트 외 발견**
- 위치: `index.html:70` `<header class="site-nav" inert aria-hidden="true">` · `app.js applyNav`
- 재현: 1440×900 에서 새로고침 → Tab 만 30번 누르며 `CONTACT` 링크에 초점이 오는지 본다
- 증거(실측, `journeys-before.json`·`journeys-after.json` 의 `3_키보드만`):
  before·after 모두 `{"탭횟수":30,"화면안":false,"사유":"30탭 안에 CONTACT 링크에 닿지 못함"}`.
  탭 40회 중 **8회가 화면 밖 요소**에 섰고, 초점 테두리가 없는 요소가 19개(대부분 갤러리 `iframe`) | 신뢰도: 실측
- 현재: 상단바는 첫 화면에서 `inert` 라 탭 순서에 없다. 건너뛰기 링크는 `#about` 한 곳만 가리킨다.
  즉 키보드 사용자가 문의로 가려면 낙하 통로·ABOUT 7칸을 전부 탭으로 지나야 한다.
- 문제인 이유: WCAG 2.2 의 2.4.1(건너뛰기)·2.4.3(초점 순서) 관점에서, 주요 목적지(문의)에 이르는 경로가 사실상 없다.
- 개선안: 건너뛰기 링크를 두 개로 — `본문 바로가기(#about)` 와 `문의 바로가기(#contact)`.
  둘 다 `.skip-link` 라 초점을 받을 때만 `top:16px` 로 나타나고, 한 번에 하나만 초점을 가지므로
  위치 규칙을 새로 만들 필요가 없다(기존 조판 건드리지 않음).
  (상단바의 `inert` 를 푸는 쪽은 첫 화면 연출 전체와 얽혀 있어 권하지 않는다.)
- 확인 기준: 새로고침 후 Tab 2회 안에 `#contact` 로 가는 링크에 초점이 오고, Enter 로 CONTACT 가 화면에 들어온다
- 부작용·주의: 건너뛰기 링크는 초점을 받을 때만 보이므로 일반 화면에는 변화가 없다.
- 관련: #E01, #M02 | 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정(실측): 새로고침 후 **Tab 2번**이면 `문의 바로가기 Skip to contact`(href `#contact`, 과녁 56px,
  초점 테두리 있음)에 초점이 온다. Enter 를 누르면 1440×900 에서 `scrollY 17,772` · `#contact` 상단이 화면 76px,
  390×844 에서 `scrollY 12,846` · 상단 64px 에 오고 초점도 CONTACT 안으로 들어간다.
  탭 40회 중 과녁 24px 미만 1건 → **0건**, 초점 테두리 없는 요소 19 → **17**

### #I06 ABOUT 마지막 칸 이름표가 두 줄로 접혀 진행 막대와 어긋남
- 기기: 공통 | 유형: 결함 | 체크: C9, B10, **체크리스트 외 발견**
- 위치: `index.html:213` `data-station` · `.studio-stop-label`
- 재현: ABOUT 을 마지막 칸까지 넘긴 뒤 아래 이름표를 본다
- 증거(실측): #I01 로 이름표를 고치면서 마지막 칸만 두 단어(`All processes`)가 되었다.
  이름표 칸은 390px 에서 폭 56px·줄높이 8px, 1440px 에서 폭 92px·줄높이 11px 인 **한 줄짜리 칸**이라
  두 단어가 두 줄로 접히며 좌우 화살표·진행 막대와 세로 중심이 어긋났다 | 신뢰도: 실측(`verify2-*.json` 의 `이름표`)
- 개선안: 다른 여섯 칸과 같이 한 단어로 — `Process` (본문 머리글 `ALL / PROCESSES` 는 그대로 둔다)
- 확인 기준: 390·1440 두 폭에서 일곱 칸 모두 `줄수: 1`
- 부작용·주의: 없음. 뜻(`07. 모든 과정`)은 그대로다.
- 관련: #I01 | 우선순위: P3 | 난이도: S
- 상태: 수정됨 | 재측정: `verify2-after.json` 이름표 — 390·1440 모두 `줄수: 1`

### #R02 마지막 게임룸에 다른 회사 게임의 상징물이 그대로 떠 있음
- 기기: 공통 | 유형: 결함(법적 위험) | 체크: K11, R4, **체크리스트 외 발견**
- 위치: `ending-scene-r15.js:252` `makePlumbob()`, 680, 1330
- 재현: ENDING 을 끝까지 내려 게임룸 구간(진행 p≈.2~.8)
- 증거: `function makePlumbob(){const geo=new THREE.OctahedronGeometry(.26,0);geo.scale(1,1.7,1);
  const mat=new THREE.MeshPhongMaterial({color:0x5ee36a,emissive:0x1f7a2a,…})}` —
  캐릭터 머리 위에서 회전하는 세로로 늘린 초록 팔면체. 코드가 스스로 `plumbob` 이라고 부른다(251·1314행 주석).
  화면: `audit/screenshots/before-nofont/chromium/390/home/33.png` | 신뢰도: 실측+코드
- 현재: The Sims(Electronic Arts)의 플럼밥을 형태·색·움직임까지 그대로 재현
- 문제인 이유: 플럼밥은 EA 의 대표적 식별 표지다. 제품을 파는 브랜드 사이트에 그대로 쓰면 상표·트레이드드레스 위험이 있고,
  '메모리얼 아카이브' 라는 사이트 정체성과도 어울리지 않는다.
- 개선안(적용하면 한 줄): `makePlumbob()` 의 형태·색을 브랜드의 빛(beam) 모티프로 바꾼다 —
  예) `new THREE.ConeGeometry(.18,.42,4)` + `color:0xe8c47a, emissive:0x8f7034` (금색 빛기둥).
  위치·회전·페이드 로직은 그대로라 다른 수정이 필요 없다.
- 확인 기준: 게임룸 구간에서 초록 팔면체가 보이지 않을 것
- 부작용·주의: **의도된 오마주일 수 있어 임의로 바꾸지 않았습니다**(모드 B: 콘텐츠 의미 변경 금지).
  `QUESTIONS.md` Q-7 로 올립니다. 배포 전 결정이 필요합니다.
- 관련: #A02 | 우선순위: P1 | 난이도: S
- 보류 사유: 상표 위험 여부와 대체 형태는 회사가 정할 일이다. 형태·색을 바꾸는 한 줄짜리 수정안까지 적어 두었고 결정만 남았다 → Q-7.
- 상태: 보류

### #A02 히어로 TV 화면 UI 가 통째로 죽어 있음 (마크업·CSS·JS 만 남음)
- 기기: 공통 | 유형: 디자인 개선 | 체크: Q4, Q5, H1, M7
- 위치: `index.html` `.hero-original__broadcast` 하위 전체, `hero.css:143~160`, `hero-original.js`
- 재현: 첫 화면에서 기기 화면 안을 본다
- 증거(실측): `getComputedStyle('.hero-original__broadcast').opacity` = **0** (powerState=locked, --entry-program=1 인데도).
  원인은 `hero.css:152~158` `.hero[data-hero-visual="keyvisual-v1"] .hero-original__broadcast{opacity:0!important;pointer-events:none}`.
  HTML 에도 `inert aria-hidden="true"` 가 붙어 있고 이를 푸는 코드는 없다(`grep inert hero-original.js` 0건).
  그런데 그 안에는 채널 버튼 4개·`REPLAY SIGNAL`·프로그램 문구가 있고 `hero-original.js:247,253` 이 클릭 핸들러까지 붙인다. | 신뢰도: 실측+코드
- 현재: 보이지도 눌리지도 않는 UI 에 마크업 20여 줄 · CSS 60여 줄 · JS 채널 전환 코드가 붙어 있음
- 문제인 이유: 결함은 아니지만, 다음 사람이 '작동하는 기능'으로 오해하기 쉽고 첫 화면 파싱·스타일 비용을 더한다.
  `#I02`(CH 03 목적지) 같은 수정도 **현재는 화면에 아무 효과가 없다.**
- 개선안: 살릴지 버릴지 결정 필요 → `QUESTIONS.md` Q-4. 모드 B 에서는 콘텐츠를 지우지 않으므로 그대로 둠.
- 우선순위: P2 | 난이도: S
- 보류 사유: 살릴지 버릴지가 결정 사항이다. 모드 B 는 콘텐츠를 지우지 않으므로 마크업을 그대로 두었다 → Q-4.
- 상태: 보류

### #M02 화면낭독기가 읽는 이름이 영어 (lang="ko" 문서)
- 기기: 공통 | 유형: 결함 | 체크: M13, M9, M3
- 위치: `index.html` 의 `aria-label`·`alt` 여러 곳
- 증거: before `aria-label="Main navigation"` `"Eternal Beam channels"` `"Previous studio stop"` `"Next studio stop"`
  `"Inside the Eternal Beam archive"` `"Records with us"` `"Contact"` `"Eternal Beam home"`,
  `alt="Eternal Beam hologram device"`. 문서는 `lang="ko"` 라 한국어 음성엔진이 영어를 한글 음가로 읽는다. | 신뢰도: 코드
- 현재: 눈에 보이는 영문 UI 이름(ABOUT/RECORDS…)은 의도된 디자인이지만, **보이지 않는 이름표까지** 영어
- 개선안: 설명 성격의 이름표만 한국어로. 화면에 보이는 영문 이름은 그대로 둔다.
  `주 메뉴` `Eternal Beam 채널` `이전 칸` `다음 칸` `Eternal Beam 아카이브 안으로` `함께한 기록 RECORDS` `문의 CONTACT`
  `Eternal Beam 첫 화면으로` `Eternal Beam 홀로그램 기기`
- 확인 기준: `index.html` 의 `aria-label`·설명용 `alt` 에 영문 전용 문장 0건
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: `grep -o 'aria-label="[^"]*"' index.html` → 12개 모두 한국어 또는 한국어+브랜드명

### #I03 ABOUT 칸 이름표의 처음 값이 옛 기획의 'STUDIO'
- 기기: 공통 | 유형: 결함 | 체크: I1, L3
- 위치: `index.html` `.studio-stop-label`
- 증거: `<span class="studio-stop-label" role="status" aria-live="polite">STUDIO</span>` —
  `journey.js:526` 이 첫 이동 전까지 덮어쓰지 않아 초기 화면에 'STUDIO' 가 보인다. | 신뢰도: 코드
- 개선안: 첫 칸 이름(`Company`)으로
- 우선순위: P3 | 난이도: S
- 상태: 수정됨 | 재측정: `index.html:220` `.studio-stop-label … >Company` — 첫 화면 이름표가 첫 칸 이름과 같다

### #E01 Tab 으로 초점을 옮기면 초점 받은 요소가 화면 밖에 있는 경우가 있음
- 기기: 데스크톱(키보드) | 유형: UX 문제 | 체크: E24, E25, M4, M6
- 위치: `app.js` 의 자체 착지 로직(`assertLanding`·`landingOffset`·`anchorFocus`)과 브라우저 기본 스크롤의 경합
- 재현: 첫 화면에서 Tab 을 계속 누른다
- 증거(실측, `scratchpad/tab.mjs`): Tab 3 → `BUTTON "→"`(ABOUT 이동 버튼) **화면 밖**, scrollY=395.
  Tab 17 → CONTACT 이름 입력칸 **화면 밖**, scrollY=17048. Tab 24 → `ONE MORE SCROLL` **화면 밖**.
  Tab 28 → 초점이 `BODY` 로 떨어짐. | 신뢰도: 실측
- 현재: 초점은 옮겨지는데 그 요소가 보이지 않는 순간이 생긴다
- 문제인 이유: 키보드 사용자는 '지금 어디에 있는지' 알 수 없다(WCAG 2.4.11 초점 가림).
- 개선안: 크기가 크다. 근본 원인은 사이트가 스크롤 위치를 직접 관리하면서 브라우저의 `focus()` 자동 스크롤을 되돌리는 것.
  `scriptFocus()`/`anchorFocus()` 가 아닌 **사용자 Tab** 으로 옮겨진 초점은 되돌리지 않도록 분기해야 한다.
- 확인 기준: 첫 화면부터 34번 Tab 하는 동안 '화면 밖' 초점 0회
- 부작용·주의: 스크롤 관리 로직 전체에 영향 → 모드 B 범위를 넘어섬. 제안으로 남김.
- 우선순위: P2 | 난이도: L
- 보류 사유: 초점이 화면 밖에 서는 것은 스크롤 관리 로직 전체가 원인이다. 스크롤 엔진 변경은 모드 B 범위 밖 — 대신 #M04(건너뛰기 링크)로 가장 중요한 경로만 냈다.
- 상태: 보류

### #E02 갤러리 안에서 Tab 할 때마다 페이지가 앞뒤로 튄다
- 기기: 데스크톱(키보드) | 유형: UX 문제 | 체크: E24, E13
- 위치: `portfolio.js` iframe 초점 브리지
- 증거(실측, `scratchpad/navtab2.mjs`): ORIGINAL 에서 Shift+Tab 9번 —
  scrollY 16470 → 16974 → 16923 → 16578 → 16823 → 16633 → 16508 → 16257 → 16147 (앞뒤로 최대 500px 진동).
  **초점이 갇히지는 않는다**(9번째에 갤러리를 빠져나와 ABOUT `←` 로 이동). | 신뢰도: 실측
- 개선안: iframe 안쪽 초점 이동 시 부모 스크롤을 고정(`preventScroll: true` 전파 또는 브리지에서 위치 복원)
- 보류 사유: iframe 안팎 초점 이동은 `portfolio.js` 의 브리지 전체를 다시 봐야 한다. 초점이 갇히지는 않아(실측 9회 만에 탈출) P0 이 아니며, 스크롤 엔진(#E03)과 함께 손보는 편이 안전하다.
- 우선순위: P2 | 난이도: M
- 상태: 보류

### #J01 ORIGINAL 구역이 휴대폰에서 위아래로 크게 빈다
- 기기: 모바일 | 유형: 디자인 개선 | 체크: B18, J3
- 위치: `original-table.css` 모바일 블록
- 증거(실측): 390×844 에서 ORIGINAL 구역 높이 2700px, 그 중 탁자 무대는 400px.
  화면 캡처에서 제목 위 115px, 무대 아래 120px 가 빈 흰 면. | 신뢰도: 실측
- 개선안: 무대 높이(`min(530px,165vw)`)와 구역 상하 여백을 화면 높이에 맞춰 조정
- 보류 사유: 무대 높이를 바꾸면 좌우 끌기 좌표(`translateX(-72%)`)와 점 네비게이션 위치가 함께 움직인다. 실기기 확인이 필요하다.
- 우선순위: P3 | 난이도: M
- 상태: 보류

### #B05 ORIGINAL → CONTACT 경계에서 캐릭터가 두 구역에 걸쳐 공중에 뜬다
- 기기: 데스크톱 | 유형: 디자인 개선 | 체크: B17, F26, G1
- 위치: `journey.js` ORIGINAL→CONTACT '다리' 구간
- 재현: 1440×900 에서 문서 17280px 부근(ORIGINAL 바닥과 CONTACT 벽 사이)에 멈춘다
- 증거: `audit/screenshots/before/chromium/1440/home/24.png` —
  ORIGINAL 탁자 앞에 앉은 캐릭터와, 그 왼쪽에서 걸어오는 두 번째 캐릭터가 **동시에** 보이고,
  걷는 쪽은 다리가 CONTACT 서랍장 위로 넘어가 바닥 없이 떠 있다. | 신뢰도: 실측
- 현재: 두 구역 경계에서 캐릭터 2개가 겹쳐 보이고 접지면이 사라진다
- 문제인 이유: 구역이 자연스럽게 이어지는 연출인데, 멈춰 보면 '공중에 뜬 두 마리'로 읽힌다.
- 개선안: 다리 구간 진행도에 따라 ORIGINAL 쪽 앉은 캐릭터를 페이드아웃하거나,
  걷는 캐릭터의 세로 위치를 두 구역의 바닥선 사이에서 보간한다. 값은 `journey.js` 의 다리 구간에서 조정.
- 확인 기준: 경계 앞뒤 ±1화면에서 캐릭터가 한 마리만 보이고 발이 바닥선에 닿아 있을 것
- 부작용·주의: 연출 의도(걸어서 넘어감)를 건드리므로 수치 조정에 실측 반복이 필요 → 모드 B 범위를 넘어 제안으로 남김
- 우선순위: P3 | 난이도: M
- 보류 사유: 연출 의도(걸어서 구역을 넘어감) 자체를 손대야 하고, 값이 실측 반복으로 맞춰져 있어 한 번에 고칠 수 없다.
- 상태: 보류

### #N05 첫 화면에서 안 쓰는 캐릭터 그림 11MB 를 먼저 받는다
- 기기: 공통 | 유형: 결함 | 체크: N6, N7, N12, J39, J40, K3
- 위치: `sofa-journey/actor.js:27`, `nav-shelf.js:51`
- 재현: 첫 화면만 띄우고 네트워크 전송량을 본다
- 증거(실측, `audit/scripts/payload.mjs`): 수정 전 첫 로드 후 9초간 **55.76MB**(transferSize 합, 요청 134건).
  전송 상위 — `photo-shaft-fall.webm` 10,074KB, `goya-fall-{flail,surprise,mid,tuck}.png` 각 **1,774KB**,
  `sit.png` 1,443KB **×3회**(같은 파일, 다른 `?v=`).
  `sofa-journey/actor.js:27` 은 `Object.values(GOYA).forEach(file=>{new Image().src=asset(file)})` 로 낙하 포즈 4장을 모듈이 켜지자마자 전부 받는다.
  `nav-shelf.js:51` 도 상단바 포즈 4종(약 4.5MB)을 같은 방식으로 받는다. 둘 다 첫 화면에서는 보이지 않는 그림이다. | 신뢰도: 실측+코드
- 현재(before): 첫 화면 대역을 낙하 영상 10MB + 캐릭터 그림 11MB 가 먼저 차지
- 문제인 이유: 4G 에서 첫 화면이 보이기까지의 시간을 통째로 잡아먹는다. LCP 후보가 2.0~2.6초로 밀린다.
- 개선안: ①영상은 화면에 들어왔을 때만 재생(#N02) ②같은 파일의 `?v=` 를 하나로 통일해 중복 다운로드 제거
  ③낙하·상단바 포즈 그림은 첫 장만 즉시 받고 나머지는 `requestIdleCallback` 로 미룬다
- 확인 기준: 첫 로드 10초 전송량과 `load` 시점 전송량이 눈에 띄게 줄 것
- 부작용·주의: 미뤄 둔 포즈가 아주 느린 회선에서 한 박자 늦게 뜰 수 있다(그 사이에는 첫 장이 보임)
- 관련: #N01 #N02 | 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정: **첫 로드 전송량(transferSize 합) 55.76MB → 39.21MB (−16.55MB, −29.7%)**, 요청 134 → 122건
  (`audit/scripts/payload.mjs`. 처음에는 −10.91MB 로 적었으나, 단계 9 에서 #N02 의 허점 두 개를 더 고쳐 감축폭이 커졌다)
  (`scratchpad/payload.mjs`, 1440×900, 로컬 서버 기준). 줄어든 몫은 ①영상 10.07MB 가 첫 화면에서 사라짐
  ②`beam-device-1920x1080.png` 중복 요청 2→1회.
  **③`requestIdleCallback` 로 미룬 캐릭터 그림은 바이트 총량을 줄이지 않는다** — 우선순위만 뒤로 민 것이고,
  이 환경의 `load` 시점이 12.6초라 총량 측정으로는 효과가 드러나지 않았다(정직하게 '미측정'으로 남긴다).
  실제 느린 회선에서의 효과는 `MANUAL_TESTS.md` MT-5-3 으로 넘긴다.

### #A03 첫 화면에 한국어 설명도, 문의로 가는 길도 없다
- 기기: 공통 | 유형: UX 문제 | 체크: A1, B11, R1, R2
- 위치: `index.html` `#home`
- 증거: 첫 화면에 보이는 글자는 `ETERNAL BEAM` / `YOUR PET. THEIR STORY. STILL GROWING.` /
  `FOR THE MOMENTS THAT DESERVE TO LAST FOREVER` / `SCROLL TO ENTER` — **전부 영문**.
  한국어 설명은 문서 6,660px 아래 ABOUT 에서 처음 나온다. 기기 화면 안의 채널 UI 는 `opacity:0`(#A02)이라
  첫 화면에서 다른 구역으로 가는 수단은 스크롤뿐이다. | 신뢰도: 실측
- 문제인 이유: 한국어 방문자가 5초 안에 '무엇을 파는 곳인지' 알 수 없고, 유일한 전환(문의)까지 30,822px 을 내려가야 한다.
- 개선안: 히어로 표어 아래 한 줄짜리 한국어 설명(예: `반려동물과 함께한 기억을 홀로그램 기기에 남깁니다`)과
  `문의하기` 버튼을 놓는다. **브랜드 카피 추가라 임의로 넣지 않았습니다** → `QUESTIONS.md` Q-8
- 우선순위: P1 | 난이도: S
- 보류 사유: 첫 화면에 넣을 한국어 문구는 브랜드 카피다. 지어내지 않았다 → Q-8(문구를 주시면 바로 넣는다).
- 상태: 보류

### #A07 마지막 게임룸이 옛 브랜드(TVA)의 마스코트·세계관 그대로다
- 기기: 공통 | 유형: 디자인 개선 | 체크: A8, A9, F1, I1
- 위치: `ending-scene-r15.js` + `ending-mascot-model-r30.js` 등 엔딩 3D 자산
- 증거: `shots 1440/30` — 주인공이 **시바견이 아니라 얼굴 달린 CRT 모니터 캐릭터**(옛 TVA 마스코트)이고,
  배경은 CNC 공작기계가 있는 기계 공장. 사이트의 나머지 구역은 전부 시바견 + 금색/크림 톤이다.
  이 구간 길이는 12,150px(1440 기준 전체 문서의 39%). | 신뢰도: 실측
- 문제인 이유: 마지막 인상이 브랜드 이야기와 무관하다. 반려동물 기억 아카이브를 보러 온 사람이
  공작기계 작업장에서 끝난다.
- 개선안: 3D 장면 전체 교체 또는 이 구간 축소 — 어느 쪽도 모드 B 범위를 크게 넘는다 → `QUESTIONS.md` Q-9
- 우선순위: P1 | 난이도: L
- 보류 사유: 3D 장면 전체 교체 또는 구간 축소 — 어느 쪽도 모드 B 범위를 크게 넘고 자산 제작이 필요하다 → Q-9.
- 상태: 보류

### #E03 휠 한 번에 1,453px, 트랙패드 한 번에 5,560px 이 흐른다
- 기기: 데스크톱 | 유형: 디자인 의견 | 체크: E2, E3, E4, E7, E8, E10, E32
- 위치: `app.js` `handleSectionWheel`·`handleAboutStationWheel`·`consumeSectionWheelLock`
- 재현: 1440×900, 첫 화면에서 실제 휠 입력
- 증거(실측, `T-before.json` `T9_실제휠`):
  | 입력 | 총이동 | 반응시작 | 90% 도달 | 정지 |
  |---|---|---|---|---|
  | 마우스 1칸 | 1,453px | 124ms | 1,910ms | 2,105ms |
  | 마우스 3칸 연속 | 2,064px | 17ms | 2,355ms | 2,622ms |
  | 고해상도 휠(4×25) | 5,554px | 64ms | 7,741ms | 8,468ms |
  | 트랙패드 플릭(감쇠 30회) | 5,560px | 179ms | 7,581ms | 8,305ms |
- 문제인 이유: 구역 단위 이동은 이 사이트의 연출 골격이므로 '결함'으로 단정하지 않는다.
  다만 **트랙패드 한 번에 6화면이 흐르고 8.3초 동안 멈추지 않는 것**은 한 구역 이동이라는 설계 의도와도 어긋난다.
- 개선안: 제스처 단위 잠금 — 한 번의 연속 입력(마지막 이벤트로부터 120ms 이내)을 한 칸으로 묶고,
  잠금이 풀리기 전의 추가 delta 는 버린다. `consumeSectionWheelLock` 에 이미 뼈대가 있으므로 그 안에서 조정.
- 확인 기준: 네 입력 모두 총이동 ≤ 1.2화면, 정지 ≤ 1,200ms
- 부작용·주의: 스크롤 체감 전반이 바뀌므로 사람이 직접 확인해야 한다(MT-3). 핵심 엔진이라 모드 B 에서는 제안으로 남김
- 우선순위: P2 | 난이도: M
- 상태: 제안만

### #D01 끝 화면 글자가 사진 위에서 읽히지 않고, 고정 단추가 저작권 표기를 덮는다
- 기기: 데스크톱 | 유형: 결함 | 체크: D3, B14, H15
- 위치: `ending.css` `.ending-actions`·`.ending-game-ui`·`#ending .site-footer`, `styles.css` `.motion-toggle`
- 증거(실측, `shots 1440/26`): 오른쪽 아래 고정 단추(`움직임 줄이기`, 상자 1339~1428×844~888)가
  `© 2026 ETERNAL BEAM` 을 덮어 `© 2026 ETERN…` 으로 잘렸다. `REPLAY ↻` 도 같은 자리.
  `ONE MORE SCROLL` 은 줄무늬 소파 위에서 거의 안 보였다.
- 개선안: 761px 이상에서 끝 화면 UI 의 오른쪽을 `max(3.3vw,116px)` 로 비우고,
  home 단계를 뺀 나머지 단계의 글자에 흰 후광(`text-shadow`)을 준다
- 확인 기준: 토글 상자와 푸터·REPLAY 상자가 겹치지 않을 것
- 우선순위: P1 | 난이도: S
- 상태: 수정됨 | 재측정: 토글[1339,844,1428,888] · 푸터 오른끝 1324 · REPLAY[1242,1324] → **겹침 false/false** (`scratchpad/ending-after.png`)

### #H03 개인정보 동의 체크박스가 20×20px (WCAG 2.2 AA 최소 24×24 미달)
- 기기: 데스크톱 | 유형: 결함 | 체크: H2, M17, J19
- 위치: `contact-letterbox.css:89`
- 증거(실측, T-before 1440 T4): `❌ 24px 미만 · 20×20 · <input type="checkbox" name="privacy_consent" required>`.
  같은 파일 151행에 `width:24px;height:24px` 가 있지만 **`@media` 휴대폰 블록 안**이라 데스크톱에는 적용되지 않았다. | 신뢰도: 실측+코드
- 문제인 이유: 이 체크박스를 누르지 않으면 문의를 보낼 수 없다. 유일한 전환 경로의 필수 조작이 최소 과녁 미달.
- 개선안: 기본 규칙을 24×24 로 올린다(휴대폰 규칙은 그대로 유효)
- 확인 기준: T4 에서 `24px 미만` 0건
- 우선순위: P2 | 난이도: S
- 상태: 수정됨 | 재측정: T4(1440×900): `❌ 24px 미만` **1건 → 0건**. 체크박스 실측 20×20 → **24×24**

### #M03 스팸 방지용 빈 칸이 `aria-hidden` 인데 이름표를 갖고 있었다
- 기기: 공통 | 유형: 결함 | 체크: M7, M9
- 위치: `contact-letterbox.js` `input.hp`
- 증거(실측, T-before 1440 T8): `❌ aria-hidden 내부인데 포커스 가능 — input.hp "스팸 방지용 빈 칸"`.
  `aria-hidden="true"` 요소에 `aria-label` 을 다는 것은 서로 모순이다. | 신뢰도: 실측+코드
- 개선안: `aria-label` 제거(`tabindex="-1"` + `.hp{left:-9999px}` 로 이미 접근 경로가 없다)
- 확인 기준: T8 결과 0건
- 우선순위: P3 | 난이도: S
- 상태: 수정됨 | 재측정: `<input type="text" name="_gotcha" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">` — `aria-label` 제거 확인(숨은 칸에 이름표가 없다)

---

## 남은 이슈 카드 (패스 2·4·5·6 에서 확인, 대부분 제안)

> 아래는 형식을 줄인 카드입니다. 각 줄의 근거는 `CHECKLIST.md` 의 해당 항목 행과 같습니다.

### #A04 RECORDS 구역의 제목 위계가 약하다
- 기기: 공통 | 유형: 디자인 의견 | 체크: A3, B18 | 위치: `gallery-original/shared/galleries.mjs` `.g02-workmark`
- 증거: `shots 1440/23` — 구역 제목이 `WITH US` 뿐이고 오른쪽 아래 끝에 걸쳐 있다. `RECORDS` 라는 글자는 폴더 목록 위 작은 제목(`.g02-categories__title`)에만 있다. 축소해 보면 사진 덩어리만 남는다 | 신뢰도: 실측
- 개선안: `RECORDS WITH US` 를 한 덩어리로 왼쪽 위에 놓거나, `WITH US` 를 현재 위치에 두되 `RECORDS` 를 같은 크기로 붙인다
- 우선순위: P3 | 난이도: S | 상태: 제안만

### #A05 구역 높이 편차가 커서 리듬이 끊긴다
- 기기: 공통 | 유형: 디자인 의견 | 체크: A5, B5, J28 | 위치: 각 구역 CSS 높이
- 증거(실측 1440): `#home` 1,620 · `#drop` 5,040 · `#about` 9,540 · `#portfolio` 824 · `#original` 824 · `#contact` 824 · `#ending` 12,150px. 가운데 세 구역이 한 화면씩이라 긴 구간 사이에 끼인다. 390 에서는 문서 전체가 25,148px
- 개선안: `#ending`(전체의 39%)을 줄이는 것이 가장 효과가 크다 — #A07 과 함께 판단
- 우선순위: P3 | 난이도: L | 상태: 제안만

### #A06 폴더 아이콘만 다른 세계의 그래픽이다
- 기기: 공통 | 유형: 디자인 개선 | 체크: A6, K6 | 위치: `galleries.mjs` `macFolderIcon`
- 증거: `shots 1440/22` — 맥 OS 풍 파란 폴더 4개. 사이트의 나머지는 금색·크림·세리프 | 신뢰도: 실측
- 개선안: 폴더를 사이트 팔레트(`--cobalt`·`--kraft`)로 다시 칠하거나 서류철 모티프로 교체
- 보류 사유: 폴더 아이콘 교체는 그래픽 자산 판단이라 사장님 확인이 필요하다.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #C03 한글·영문 혼용 시 크기·기준선이 어긋난다
- 기기: 공통 | 유형: 디자인 개선 | 체크: C2, C4 | 위치: `styles.css` `--sans`·`--mono` 글꼴 스택
- 증거: `--sans:"Cinzel","Pretendard Variable",…` — 라틴은 Cinzel(세리프), 한글은 Pretendard(고딕)로 갈린다. 같은 줄의 `Eternal Beam은 기기를…` 에서 두 글꼴의 인상이 다르다. `size-adjust`·`ascent-override` 보정 없음 | 신뢰도: 실측+코드
- 개선안: 본문용 `@font-face` 를 따로 만들어 `size-adjust` 로 x-height 를 맞추거나, 본문 라틴도 Pretendard 로 통일
- 보류 사유: 글꼴 스택을 바꾸면 사이트 전체 인상이 달라진다 — 브랜드 결정 사항.
- 우선순위: P3 | 난이도: M | 상태: 보류

### #C04 히어로 표어 글자 쪼개기가 폰트 도착·창 크기 변경을 기다리지 않는다
- 기기: 공통 | 유형: 결함 | 체크: C15, F14 | 위치: `hero-original.js fillStmtLetters()`
- 증거: `document.fonts.ready` 대기 없음, `resize` 재분할 없음(코드) | 신뢰도: 코드
- 개선안: `document.fonts.ready.then(...)` 뒤에 쪼개고, `resize` 에 재분할을 건다. 대상이 한 줄이라 비용은 작다
- 보류 사유: 대상이 히어로 표어 한 줄이고 현재 눈에 띄는 증상이 없어, 글꼴 로딩 전략(#C03)과 함께 다루는 편이 낫다.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #C05 모바일 본문이 12~13px 이다
- 기기: 모바일 | 유형: 디자인 개선 | 체크: C16, J2 | 위치: `about-walk.css` `.beam-gold__body p`, `ending.css` 푸터
- 증거: 골드 칸 본문 12px, 끝 화면 푸터 10px(실측) — 권장 16px
- 개선안: 골드 칸 본문 14px 이상. 칸 높이가 빠듯하므로 #C02 의 높이 규칙과 함께 조정해야 한다
- 보류 사유: 골드 칸은 높이가 빠듯해(#C02 참조) 글자를 키우면 다시 잘린다. 칸 높이 규칙과 함께 재설계해야 한다.
- 우선순위: P3 | 난이도: M | 상태: 보류

### #D02 낙하 구간의 `SCROLL` 안내가 배경에 묻힌다
- 기기: 공통 | 유형: UX 문제 | 체크: D2, D3 | 위치: `scroll-cue.css` `.scroll-cue{color:#fff;mix-blend-mode:difference}`
- 증거: `shots 1440/05` — 소용돌이 위에서 거의 보이지 않는다. T11 은 blend 를 계산하지 못해 `흰색 on 흰색 = 1.0` 으로 보고 | 신뢰도: 실측
- 개선안: blend 는 유지하되 뒤에 옅은 어두운 판(`radial-gradient`)을 깔거나, 밝은 배경에서만 blend 를 끈다
- 보류 사유: `mix-blend-mode` 는 의도된 연출이다. 뒤에 판을 깔면 안내가 사이트 톤에서 튀므로 디자인 판단이 필요하다.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #D03 다크 모드 대응이 없는데 `theme-color` 만 검다
- 기기: 모바일 | 유형: 디자인 개선 | 체크: D8, D10 | 위치: `index.html` `<meta name="theme-color" content="#0d0d0f">`
- 증거: `dark-mode.json` — 다크 전용 규칙 0개, 본문 배경 흰색. 그런데 브라우저 UI 색은 검정으로 지정 | 신뢰도: 실측
- 개선안: `theme-color` 를 본문과 맞추거나(`#f6f2e8`), `media="(prefers-color-scheme: dark)"` 로 두 벌 선언. 자동완성 배경색(`:-webkit-autofill`)도 편지지 색으로 지정
- 보류 사유: `theme-color` 를 바꾸면 모바일 브라우저 UI 인상이 달라진다 — 브랜드 결정 사항.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #E04 ABOUT 가로 구간에 `overscroll-behavior-x` 가 없다
- 기기: 모바일·트랙패드 | 유형: 결함 | 체크: E12, J23 | 위치: `about.css` `.studio-track`·`.about-camera`
- 증거: 코드에 `overscroll-behavior-x` 선언 0건. 가로 이동 구간에서 두 손가락 가로 스와이프가 브라우저 뒤로가기로 갈 수 있다 | 신뢰도: 코드 (실기기 확인 → MT-1-3)
- 개선안: `.about-camera{overscroll-behavior-x:contain}`
- 보류 사유: 한 줄로 고칠 수 있지만, 가로 스와이프 동작은 실기기에서 확인해야 부작용(뒤로가기 차단)을 판단할 수 있다 → MT-1-3.
- 우선순위: P2 | 난이도: S | 상태: 보류

### #E05 아주 느린 핀치 확대가 막힐 수 있다
- 기기: 데스크톱(정밀 트랙패드) | 유형: 결함 | 체크: E27 | 위치: `app.js:653~654`
- 증거: 653행 `if (Math.abs(event.deltaY) < 4 && event.deltaMode === 0) { event.preventDefault(); return true; }` 가 654행의 `event.ctrlKey` 검사보다 **먼저** 실행된다 | 신뢰도: 코드
- 개선안: 653행 앞에 `if (event.ctrlKey) return false;` 한 줄
- 보류 사유: 한 줄 수정이지만 휠 처리 순서를 바꾸는 일이라, 스크롤 체감 전체를 사람이 확인해야 한다(MT-3)와 묶어 진행하는 것이 안전하다.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #E06 전역 `touchmove` 가 항상 non-passive 다
- 기기: 모바일 | 유형: UX 문제 | 체크: E35 | 위치: `app.js:794`
- 증거: `window.addEventListener('touchmove', …, {passive:false})` 인데 실제로 막는 조건은 `touchStart !== null`(맨 아래에서만) | 신뢰도: 코드
- 개선안: `app.js` 의 전역 `touchmove` 를 `{passive:true}` 로 두고, 가로 트랙 구간에서만
  non-passive 리스너를 붙였다 떼는 방식으로 바꾼다(`addEventListener('touchmove',fn,{passive:false})` 는 그 구간 한정).
- 보류 사유: 리스너 등록/해제를 동적으로 바꾸면 맨 아래 재생(replay) 판정과 얽힌다. 측정된 체감 손해가 없어 다음 패스로 미룬다.
- 우선순위: P3 | 난이도: M | 상태: 보류

### #F01 WebGL 에 DPR 상한·컨텍스트 손실 복구가 없다
- 기기: 공통 | 유형: 결함 | 체크: F21 | 위치: `ending-scene-r15.js`, `world-scene.js`
- 증거: `setPixelRatio` 에 상한을 두는 코드와 `webglcontextlost` 처리 grep 0건 | 신뢰도: 코드
- 개선안: `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, `canvas.addEventListener('webglcontextlost', …)` 로 대체 화면 전환(대체 경로는 이미 있다)
- 보류 사유: DPR 상한과 컨텍스트 손실 복구는 실제 GPU 환경에서 확인해야 의미가 있는데, 이 컨테이너는 소프트웨어 렌더러다.
- 우선순위: P2 | 난이도: S | 상태: 보류

### #H13 인앱 브라우저에서 `mailto:` 가 막히면 문의 경로가 없다
- 기기: 모바일 | 유형: UX 문제 | 체크: H13, R2, J41 | 위치: `contact-letterbox.js`
- 증거: 카카오톡·인스타그램 인앱 브라우저는 `mailto:` 를 무시하는 경우가 있다(업계 알려진 동작). 실기기 확인 필요 → MT-2-3 | 신뢰도: 추정
- 개선안: 완료 화면(`.posted`)의 메일 주소 옆에 44×44 이상 **복사 단추**를 둔다 —
  `navigator.clipboard.writeText(MAIL)` 한 줄이면 되고 서버가 필요 없다. 실패하면 주소 자체가 이미 보이므로 손해가 없다.
- 보류 사유: 인앱 브라우저의 `mailto:` 차단 여부를 이 환경에서 재현할 수 없다(실기기 필요). 완료 화면에 메일 주소를 노출하는 최소 우회로는 이미 넣었다 → MT-2-3 · Q-3.
- 우선순위: P2 | 난이도: S | 상태: 보류

### #I04 bfcache 복귀 처리(`pageshow`)가 없다
- 기기: 공통 | 유형: 결함 | 체크: I6 | 위치: 전역
- 증거: `pageshow`·`persisted` grep 0건 | 신뢰도: 코드
- 개선안: `addEventListener('pageshow', e => { if (e.persisted) { /* 커튼 내리기·루프 재개 */ } })`
- 보류 사유: bfcache 동작은 실기기 뒤로가기로만 확인된다(MT-1). 확인 없이 `pageshow` 처리를 넣으면 되레 전환 연출이 두 번 돌 수 있다.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #I05 404 페이지가 없었다
- 기기: 공통 | 유형: 결함 | 체크: I9 | 위치: 저장소 루트
- 증거: 수정 전 `404.html` 없음 → 호스팅 기본 오류 화면이 뜬다 | 신뢰도: 코드
- 개선안: 브랜드 톤의 `404.html` 추가(주요 구역 링크 5개, `noindex`)
- 확인 기준: `/없는주소` 요청 시 브랜드 화면이 나올 것(정적 호스팅이 404 문서를 쓰도록 설정돼 있어야 함 → Q-10)
- 우선순위: P2 | 난이도: S | 상태: 수정됨 | 재측정: `404.html` 존재 · 주요 구역 링크 **5개** · `noindex` 선언 1건. (호스팅이 이 문서를 404 로 쓰도록 설정하는 일은 Q-10)

### #J02 `env(safe-area-inset-*)` 을 쓰는데 `viewport-fit=cover` 가 없다
- 기기: 모바일(iOS) | 유형: 결함 | 체크: J12, J13 | 위치: `index.html` viewport meta
- 증거: `env(safe-area-inset-bottom)` 5곳 사용. viewport meta 는 `width=device-width,initial-scale=1` 뿐 — `viewport-fit=cover` 가 없으면 `env()` 가 0 이라 안전영역 보정이 **아무 일도 하지 않는다** | 신뢰도: 코드
- 개선안: `content="width=device-width,initial-scale=1,viewport-fit=cover"`
- 부작용·주의: 노치 영역까지 화면이 넓어지므로 좌우 여백을 함께 확인해야 한다 → 실기기 확인 후 적용 권장(MT-1)
- 보류 사유: `viewport-fit=cover` 는 노치 영역까지 화면을 넓히므로 좌우 여백을 실기기에서 같이 봐야 한다 → MT-1.
- 우선순위: P2 | 난이도: S | 상태: 보류

### #J03 `-webkit-text-size-adjust` 미지정
- 기기: 모바일(iOS) | 유형: 결함 | 체크: J15 | 위치: `styles.css`
- 증거: grep 0건 — iOS 가로 전환 시 글자가 갑자기 커질 수 있다 | 신뢰도: 코드
- 개선안: `html{-webkit-text-size-adjust:100%}`
- 보류 사유: `-webkit-text-size-adjust` 는 iOS 가로 전환에서만 드러난다. 실기기 확인(MT-1-7) 뒤 넣는 것이 맞다.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #J04 hover 규칙에 포인터 분기가 거의 없다
- 기기: 모바일 | 유형: UX 문제 | 체크: J20, J21, P9 | 위치: CSS 전역
- 증거: `@media (hover: hover)` 는 `ending.css:64` 한 곳뿐. `any-hover`·`any-pointer` 0건 | 신뢰도: 코드
- 개선안: hover 전용 시각 효과를 `@media (hover:hover) and (pointer:fine)` 로 감싼다
- 보류 사유: hover 규칙 전체를 포인터 분기로 감싸는 작업이라 범위가 넓고, 터치 잔상은 실기기에서 확인해야 한다(MT-1).
- 우선순위: P3 | 난이도: M | 상태: 보류

### #J05 ~~입력칸 글자가 16px 미만이라 iOS 가 자동 확대한다~~ → **오판, 해당 없음**
- 기기: 모바일(iOS) | 유형: 결함 | 체크: J36 | 위치: `contact-letterbox.css` 입력칸
- 처음 증거(코드, **틀렸음**): "입력칸 글자 13~14px" — `.ctl` 뿌리의 축소 배율을 보고 글자 크기로 잘못 읽었다.
  iOS Safari 가 보는 것은 `font-size` 의 계산값이지 화면에 보이는 크기가 아니다.
- 재검증(실측): 320·360·390·414·768 다섯 폭에서 편지지를 열고 `getComputedStyle(input).fontSize` 를 읽었다.
  `name·email·phone·message` **모두 16px** — 수정 전 원본(`:18769`)과 작업 트리(`:18768`) 양쪽 동일.
  근거 규칙도 확인: `contact-letterbox.css:61` `font:16px …`, `:147` `.ctl .f input,.ctl .f textarea{font-size:16px}`
  | 신뢰도: 실측(`verify2-before.json`·`verify2-after.json` 의 `입력칸글자`)
- 개선안: **없음 — 고칠 것이 없다.** 원래부터 `font-size:16px` 이므로 iOS 자동 확대 조건(16px 미만)에 해당하지 않는다.
- 결론: 처음 판단이 틀렸다. 카드는 지우지 않고 철회 상태로 남긴다(같은 오판을 되풀이하지 않기 위해).
  (동의 체크박스 옆 설명글은 10.5px 이지만 이것은 `label` 이라 자동 확대와 무관하다 — 글자 크기 자체는 #C05 에서 다룬다.)
- 우선순위: — | 난이도: — | 상태: 해당 없음(오판 철회)

### #K03 원본보다 크게 늘려 쓰는 그림 3건
- 기기: 공통 | 유형: 디자인 개선 | 체크: K1, G3 | 위치: 문의 배경·낙하 포스터·히어로 기기
- 증거(T5): `archive-drawers.webp` 535×682 → 979×824 표시 · `photo-shaft.jpg` 1024×682 → 3349×3603 · `beam-device` 1920×1080 → 진입 확대 중 9201×5176 | 신뢰도: 실측
- 개선안: 문의 배경과 낙하 포스터는 2배 크기 원본을 준비. 히어로는 연출상 불가피
- 보류 사유: 더 큰 원본 이미지를 새로 만들어야 한다 — 자산 작업이라 Q-11 과 함께 판단.
- 우선순위: P3 | 난이도: M | 상태: 보류

### #K04 1MB 넘는 그림에 `decoding="async"` 가 없다
- 기기: 공통 | 유형: 디자인 개선 | 체크: G8 | 위치: 캐릭터 PNG 를 만드는 JS 여러 곳
- 증거: `decoding='async'` 는 탁자·엔딩·(이번에 추가한) 미리받기에만 | 신뢰도: 코드
- 개선안: 캐릭터 그림을 만드는 곳(`nav-shelf.js` `new Image()`, `about-walk.js` `preloaded`, `journey.js` 포즈 교체)에
  `img.decoding = 'async'` 를 일괄 지정한다 — 1MB 넘는 PNG 가 메인 스레드에서 디코딩되는 것을 막는다.
- 보류 사유: 이미지 최적화(#N06, Q-11)와 같은 파일들을 건드리므로 그때 한 번에 넣는 편이 낫다.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #N03 스크롤 중 긴 프레임 230회, CLS 0.278
- 기기: 공통 | 유형: 결함 | 체크: N2, N4, N5, E33, E34, F12 | 위치: `app.js tick`, `sofa-journey/scene.js`
- 증거(T-before 1440): 긴 애니메이션 프레임 **230회**(최장 354ms, 원인 `app.js tick`), CLS 누적 **0.278**(390 은 1.56),
  CLS 상위 4건 전부 `div.sofa-journey__cushion`. hover 판정이 256~688ms 지연 | 신뢰도: 실측
- 통제 조건 재측정(`cls.mjs`, 같은 절대 위치를 40단계로 지나감 — T7 의 CLS 는 스크롤 경로에 따라 달라져 두 판을 견줄 수 없다):
  - 1440: **값이 두 갈래**(1.366대 / 0.371대). 두 갈래가 before·after 양쪽에 똑같이 나타나므로 **수정 전후 차이 없음**.
    낮은 갈래의 원인 1위는 `div.studio-host` 0.3594, 높은 갈래는 거기에 `div.signal-passage` 1.000 이 더해진다.
  - 390: before **0.3113**(이동 26~27회) → after **0.2208**(이동 3~4회). 줄어든 0.0893 은 사라진
    `img.studio-host__swap` 의 몫과 정확히 같다(#B04 로 휴대폰에서 ABOUT 캐릭터를 세우지 않게 된 결과).
- 개선안: ①낙하 구간의 위치 변화를 `top` 이 아니라 `transform` 으로 → CLS 소멸 ②`app.js tick` 의 프레임당 작업을 줄이거나 나눠 실행
- 부작용·주의: 낙하 연출 전체를 건드려야 하고 값이 손으로 맞춰져 있다 → 모드 B 범위 밖
- 보류 사유: 낙하 연출의 위치 계산을 `top` 에서 `transform` 으로 옮기는 작업이라 연출 값 전체를 다시 맞춰야 한다 — 모드 B 범위 밖. 다만 모바일 몫(`studio-host__swap`)은 #B04 로 사라져 CLS 0.311→0.221 로 줄었다.
- 우선순위: P1 | 난이도: L | 상태: 보류

### #N04 `will-change` 51곳, 해제는 한 곳뿐
- 기기: 공통 | 유형: 디자인 개선 | 체크: F13, F24 | 위치: CSS 전역
- 증거: `will-change` 51회 선언, 해제는 `.is-live` 토글 하나. 첫 화면 실행 중 애니메이션 54개(T3) | 신뢰도: 실측+코드
- 개선안: 화면 밖 구역에서 `will-change:auto` 로 되돌린다(낙하 구간에 이미 그 패턴이 있다)
- 보류 사유: `will-change` 해제는 구역별 가시성 판정을 새로 붙여야 한다. 측정상 메모리 문제는 관측되지 않아 다음 패스로 미룬다.
- 우선순위: P3 | 난이도: M | 상태: 보류

### #N06 이미지·번들 최적화가 전혀 안 돼 있다
- 기기: 공통 | 유형: 결함 | 체크: K2, N6, N12, J29, J39 | 위치: `assets/goya/*.png`, `vendor/three.module.js`
- 증거(실측): 캐릭터 PNG 1.0~1.8MB × 다수, 표시 크기는 66~430px. `three.module.js` 1,192KB 를 첫 화면에서 받는다. 모바일도 같은 원본(`srcset` 은 한 곳뿐). 수정 후에도 첫 로드 39.21MB | 신뢰도: 실측
- 개선안: ①`assets/goya/*.png` 를 표시 크기의 2배로 줄여 WebP 변환(`tools/` 에 sharp 파이프라인이 이미 있다) ②`three.module.js` 를 엔딩 진입 시 동적 import ③모바일용 `srcset` 추가
- 부작용·주의: **원본 화질에 대한 판단이 필요해 임의로 재인코딩하지 않았습니다** → `QUESTIONS.md` Q-11
- 보류 사유: 원본 화질을 어디까지 떨어뜨려도 되는지는 사람이 봐야 한다. 임의로 재인코딩하지 않았다 → Q-11.
- 우선순위: P1 | 난이도: M | 상태: 보류

### #N07 캐싱·압축 설정 파일이 저장소에 없다
- 기기: 공통 | 유형: 결함 | 체크: N9 | 위치: 저장소 루트
- 증거: `_headers`·`netlify.toml`·`vercel.json`·`.htaccess` 등 어떤 호스팅 설정도 없다. 로컬 측정에서 같은 URL 의 그림이 2~4회 재요청된 것도 `Cache-Control` 부재 때문 | 신뢰도: 실측+코드
- 개선안: 호스팅에 맞는 캐시 헤더 파일 추가 — `assets/**` 는 `max-age=31536000, immutable`(모든 파일에 `?v=` 가 붙어 있어 안전), HTML 은 `no-cache`
- 부작용·주의: 어떤 호스팅을 쓰는지 몰라 파일 형식을 정할 수 없다 → `QUESTIONS.md` Q-10
- 보류 사유: 호스팅을 모르면 캐시 헤더 파일 형식(`_headers`·`netlify.toml`·`nginx.conf`…)을 정할 수 없다 → Q-10.
- 우선순위: P1 | 난이도: S | 상태: 보류

### #P01 지원 브라우저 범위가 정의돼 있지 않고 `@supports` 분기가 없다
- 기기: 공통 | 유형: 결함 | 체크: P1, P2 | 위치: 저장소 전역
- 증거: browserslist·README 에 지원 범위 없음. `svh`·`:has()`·`overflow:clip`·`text-wrap` 을 쓰면서 `@supports` 0건 | 신뢰도: 코드
- 개선안: README 에 지원 범위를 적고, 최소한 `svh` 와 `:has()` 에 대체 경로를 둔다
- 보류 사유: 지원 범위는 회사가 정하는 값이다. 정하지 않은 상태에서 `@supports` 분기를 넣으면 어떤 대체 경로가 맞는지 알 수 없다.
- 우선순위: P2 | 난이도: M | 상태: 보류

### #Q03 디자인 토큰이 흩어져 있다
- 기기: 공통 | 유형: 디자인 개선 | 체크: Q1, B1, B3, B4, C6, A12, F3 | 위치: CSS 전역
- 증거(T3 1440): 간격 38종 · 글자크기 28종 · 글자색 26종 · 배경색 22종 · 글꼴조합 61종 · radius 7종 · 그림자 9종 · easing 5종
- 개선안: `REPORT.md` §13.2 의 간격 8단계(`4·8·12·16·24·32·48·64px`)로 모은다 — 지금 고유값 38개 중
  `34.56px`·`37.44px` 같은 값은 `vw` 계산의 부산물이라 `clamp()` 한 줄로 흡수된다.
- 보류 사유: 토큰 통합은 CSS 전 파일에 걸친다. 제안 값은 REPORT 의 디자인 시스템 제안에 수치로 정리해 두었다.
- 우선순위: P3 | 난이도: L | 상태: 보류

### #Q04 `!important` 139회
- 기기: 공통 | 유형: 디자인 개선 | 체크: Q2 | 위치: `hero.css`(47) 등
- 증거: 파일별 집계 — `only-tva-walk.css` 54(미사용) · `hero.css` 47 · `hero-material.css` 10 · `ending.css` 10 · `styles.css` 6 · `character-direction.css` 5(미사용) · `about.css` 3 · 기타 4
- 개선안: 쓰지 않는 파일(`only-tva-walk.css` 54회 · `character-direction.css` 5회)을 먼저 지우면 **59회가 바로 줄고**,
  남은 `hero.css` 47회는 `.hero-original__stage` 한 겹을 앞에 붙이는 것으로 대부분 대체된다(특이도 0-1-0 → 0-2-0).
- 보류 사유: `!important` 139회를 걷어내려면 선택자 특이도를 재설계해야 한다. 시각 회귀 장치(#Q06)가 먼저 필요하다.
- 우선순위: P3 | 난이도: L | 상태: 보류

### #Q05 쓰지 않는 옛 구현이 그대로 남아 있다
- 기기: 공통 | 유형: 디자인 개선 | 체크: Q4 | 위치: `INVENTORY.md` 10번 목록
- 증거: 모듈 그래프 밖 JS 14개·CSS 5개. 엔딩 장면만 `ending-scene{,-r13,-r14,-r15}.js` 4벌
- 개선안: 되살릴 계획이 없으면 삭제 → `QUESTIONS.md` Q-5
- 보류 사유: 되살릴 계획이 있는 파일인지 알 수 없다. 모드 B 는 콘텐츠·코드를 임의로 지우지 않는다 → Q-5.
- 우선순위: P3 | 난이도: S | 상태: 보류

### #Q06 회귀 방지 장치가 없다
- 기기: 공통 | 유형: 디자인 개선 | 체크: Q7 | 위치: 저장소 전역
- 증거: 린트·테스트·CI 설정 파일 0건
- 개선안: 이번에 남긴 `audit/capture.mjs`(시각 회귀)와 `audit/scripts/*.js`(수치 측정)를 CI 에 건다. `node --check` 만이라도 커밋 훅에 넣는다
- 보류 사유: 린트·CI 도입은 저장소 운영 방식(호스팅·CI 서비스)에 달려 있다 — Q-10 답을 받은 뒤에 넣는 것이 맞다.
- 우선순위: P3 | 난이도: M | 상태: 보류

### #R03 회사 표기(법적 고지)가 비어 있다
- 기기: 공통 | 유형: 결함 | 체크: R3, R4, L9 | 위치: `index.html` `.site-footer`, JSON-LD, `privacy.html`
- 증거: 푸터에 `상호 Eternal Beam (이터널빔) · 서울 Seoul` 뿐. 대표자·사업자등록번호·주소·전화·통신판매업 신고번호 없음 | 신뢰도: 실측
- 개선안: 값을 받아 푸터·JSON-LD·개인정보 처리방침 세 곳에 채운다. **지어낼 수 없는 값이라 비워 두었습니다** → `QUESTIONS.md` Q-1
- 보류 사유: 상호·대표자·사업자등록번호는 지어낼 수 없는 값이다 → Q-1(배포 전 필수).
- 우선순위: P1 | 난이도: S | 상태: 보류

### #S01 인쇄용 스타일이 없다
- 기기: 공통 | 유형: 디자인 개선 | 체크: S7 | 위치: CSS 전역
- 증거: `@media print` 0건 | 신뢰도: 코드
- 개선안: 개인정보 처리방침만이라도 인쇄 가능하게(`privacy.html` 에 `@media print`)
- 보류 사유: 인쇄 대상이 개인정보 처리방침 정도라 우선순위가 낮다.
- 우선순위: P3 | 난이도: S | 상태: 보류
