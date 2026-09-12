// TVA ORIGINAL — 책상 위 네 칸의 자료.
// 실제 작품 자료가 오면 이 파일의 값만 채우면 상세창이 저절로 채워진다(다른 파일 수정 없음).
//   title    작품 이름. 지금 값은 '자리 이름'이지 지어낸 작품명이 아니다.
//   image    작품 그림 경로(.webp). null 이면 상세창에서 그림 자리가 통째로 사라진다.
//   alt      그림 대체 글. image 를 채울 때 같이 채운다.
//   creator  원작자 · year 연도 · source 출처.
//            셋 다 비어 있으면 상세창의 'ORIGINAL WORK' 줄 자체가 나오지 않는다.
//            (originals.js 가 값이 있는 것만 ' · ' 로 이어 붙인다 — 빈 값은 사라진다.)
// 칸 수를 바꾸려면 original-table.css 249행 min-height 와 originals.js 의 네 장짜리
// 좌표(PLANES)도 같이 맞춰야 한다. 확정된 작품 수가 정해지기 전에는 네 칸을 유지한다.
export const originalWorks = [
  { id: 'collection-01', title: 'LETTER', image: null, alt: 'Soul Trace 편지', position: 'xMidYMid', creator: 'Soul Trace', year: '2026', source: '' },
  { id: 'collection-02', title: 'IDENTITY', image: null, alt: 'Identity Lock', position: 'xMidYMid', creator: 'Eternal Beam', year: '2026', source: '' },
  { id: 'collection-03', title: 'HOLOGRAM', image: null, alt: '홀로그램 디스플레이', position: 'xMidYMid', creator: 'Eternal Beam', year: '2026', source: '' },
  { id: 'collection-04', title: 'ARCHIVE', image: null, alt: '라이프 아카이브', position: 'xMidYMid', creator: 'Eternal Beam', year: '2026', source: '' },
];
