// T6. 제목 구조·랜드마크·접근 가능한 이름 (M1, M2, M8, M9, M13)
// audit/PROMPT.md 부록 A 원문
(() => {
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const headings = hs.map((h, i) => { const lv = +h.tagName[1], prev = i ? +hs[i - 1].tagName[1] : 0; return { 레벨: h.tagName, 단계건너뜀: prev && lv - prev > 1 ? '❌' : '', 텍스트: h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) }; });
  const accName = el => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) || el.innerText || el.title || el.querySelector('img[alt]')?.alt || el.querySelector('svg title')?.textContent || '').trim();
  const 이름없는버튼링크 = [...document.querySelectorAll('a[href], button, [role=button]')].filter(el => el.getBoundingClientRect().width && !accName(el)).map(el => el.outerHTML.slice(0, 100));
  const 라벨없는입력 = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), select, textarea')].filter(el => !(el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title)).map(el => el.outerHTML.slice(0, 100));
  const first = document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const lm = { header: 'banner', nav: 'navigation', main: 'main', footer: 'contentinfo' };
  const 요약 = {
    h1개수: document.querySelectorAll('h1').length,
    랜드마크: Object.entries(lm).map(([t, r]) => `${t}:${document.querySelectorAll(`${t},[role=${r}]`).length}`).join(' '),
    'alt 없는 img': document.querySelectorAll('img:not([alt])').length, 이름없는버튼링크: 이름없는버튼링크.length, 라벨없는입력: 라벨없는입력.length,
    본문바로가기: first?.getAttribute('href')?.startsWith('#') ? '추정 있음 (첫 포커스 요소가 # 링크)' : '❌ 없음(추정)',
    '양수 tabindex': document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex^="-"])').length,
    lang: document.documentElement.lang || '❌'
  };
  console.table(요약); console.table(headings); console.log('이름 없는 버튼/링크:', 이름없는버튼링크); console.log('라벨 없는 입력:', 라벨없는입력);
  return { 요약, headings, 이름없는버튼링크, 라벨없는입력 };
})();
