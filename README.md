# Eternal Beam — 홈페이지

반려동물과 함께한 기억을 Soul Trace 앱에 기록하고, 전용 홀로그램 기기(Eternal Beam) 안에
콘텐츠 아카이브로 남기는 브랜드의 한 장짜리 소개 사이트입니다.

빌드 도구·패키지·번들러·프레임워크가 없습니다. 정적 파일 그대로 올리면 됩니다.

## 보는 방법

폴더 안에서 작은 서버를 띄우고 브라우저로 엽니다.

```sh
python3 -m http.server 8000
# http://127.0.0.1:8000/
```

`index.html` 을 두 번 눌러 여는 방식(`file://`)은 안 됩니다. 화면을 만드는 파일들이
ES 모듈로 서로를 불러오기 때문에 반드시 HTTP 로 띄워야 합니다.

소스를 고친 뒤에는 강력 새로고침(또는 새 시크릿 창)으로 캐시된 모듈을 버리십시오.

## 화면 순서

`MAIN → DROP → ABOUT → RECORDS → ORIGINAL → CONTACT → ENDING` 일곱 구역이
한 문서 안에 이어져 있습니다. DROP 은 메뉴에 없는 전환 구간입니다.

| 구역 | id | 내용 |
| --- | --- | --- |
| MAIN | `#home` | 기기 키비주얼, 채널 4개(INTRO / WHO WE ARE / ARCHIVE / CONTACT) |
| DROP | `#drop` | 소파로 떨어지는 전환 연출 (상단 메뉴 없음) |
| ABOUT | `#about` | 가로로 이어지는 7칸 — 01 회사소개 · 02 LETTER · 03 IDENTITY · 04 HOLOGRAM DISPLAY · 05 MOTION · 06 ARCHIVE · 07 모든 과정 |
| RECORDS | `#portfolio` | iframe 안의 오목한 수레바퀴 갤러리 (`gallery-original/`) |
| ORIGINAL | `#original` | 책상 위 네 칸 — LETTER · IDENTITY · HOLOGRAM · ARCHIVE |
| CONTACT | `#contact` | 편지지 문의 양식 |
| ENDING | `#ending` | 거실 장면, 처음으로 돌아가기 |

상단 메뉴는 ABOUT · RECORDS · ORIGINAL · CONTACT 네 개입니다. MAIN 과 ENDING 에서는
메뉴가 접히고, DROP 은 메뉴에 없는 구간입니다.

## 배포 전에 확인할 것

- **도메인**: `https://device.eternalbeam.com` 기준으로 `index.html` 의 canonical·OG·
  JSON-LD, `sitemap.xml`, `robots.txt` 가 모두 절대 주소로 적혀 있습니다. 주소가 바뀌면
  이 네 파일을 함께 고치십시오.
- **문의**: 보내기는 방문자의 메일 앱에 편지를 담아 주는 `mailto:` 동작입니다. 서버로
  보내지도, 저장하지도 않습니다. 받는 주소는 `contact-letterbox.js` 의 `MAIL` 한 곳입니다.
  실제 접수 백엔드를 붙이면 `privacy.html` 의 '처리 위탁' 줄도 같이 고쳐야 합니다.
- **RECORDS 자료**: 지금 걸린 사진과 분류는 **예시**입니다. 실제 자료는
  `gallery-original/shared/galleries.mjs` 의 `categories` 한 곳에서 채웁니다.
  화면에도 예시임을 알리는 띠가 떠 있습니다 — 실제 자료를 넣기 전에는 지우지 마십시오.
- **ORIGINAL 자료**: `original-works.js` 의 네 줄만 채우면 상세창이 저절로 채워집니다.
- **회사 표기**: 대표자·사업자등록번호·주소·연락처는 확정된 값이 없어 비어 있습니다.
  `index.html` 의 `.site-footer` 와 JSON-LD 에 채우십시오.
- **외부 의존**: Google Fonts 와 jsDelivr(Pretendard) 두 곳입니다. 둘 다 없어도 본문은
  OS 글꼴로 읽힙니다.
- **파일을 고쳤으면 `?v=` 를 올리십시오.** 모든 CSS·JS·그림은 `파일명?v=판번호` 로 불립니다.
  내용을 고치고 판 번호를 그대로 두면, **이미 방문한 적 있는 사람은 옛 파일을 계속 받습니다.**
  - 규칙: 고친 파일만 `?v=eb-YYYYMMDD` 로 올린다. 안 고친 파일은 건드리지 않는다
    (전부 올리면 모든 방문자가 캐시를 통째로 다시 받습니다).
  - **같은 파일을 부르는 곳을 전부** 함께 고쳐야 합니다. 한 군데만 고치면 같은 파일을 두 번 받습니다.
  - 확인: `node qa-check.mjs` 의 `[2] 같은 파일을 여러 주소로 부르는 곳` 이 0건이어야 합니다.
    실행 중에 만들어지는 주소까지 보려면 서버를 띄운 뒤
    `node audit/scripts/verify2.mjs 확인 http://127.0.0.1:8000` 의 `중복주소` 가 0건인지 보십시오.
  - 캐릭터 그림(`assets/goya/*.png`)의 판 번호는 `journey.js` 의 `GOYA_V` 한 곳에 모여 있습니다.

## 배포에 올리지 않는 것

정적 호스팅에 올릴 때는 아래를 빼십시오. 사이트가 부르지 않는 파일입니다.

- `tools/` — 그림을 굽는 작업용 스크립트와 중간 프레임 (약 79MB)
- `정본_안내.md`, `읽어주세요.md` — 내부 작업 기록
- `at-tva-before.png` — 작업 중 찍어 둔 화면 캡처

## 점검

```sh
node qa-check.mjs      # 끊긴 링크·없는 파일·자리표시자 남은 곳 확인
```
