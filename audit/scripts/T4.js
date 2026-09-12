// T4. 작은 터치·클릭 영역 (H2, J19)
// audit/PROMPT.md 부록 A 원문
(() => {
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [onclick], [tabindex]:not([tabindex="-1"])';
  const rows = [...document.querySelectorAll(sel)]
    .map(el => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && (r.width < 44 || r.height < 44))
    .map(({ el, r }) => ({ 판정: r.width < 24 || r.height < 24 ? '❌ 24px 미만' : '⚠️ 24~44px', 가로: Math.round(r.width), 세로: Math.round(r.height), 텍스트: (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 30), html: el.outerHTML.slice(0, 90) }))
    .sort((a, b) => a.판정.localeCompare(b.판정));
  console.log('주의: 문장 속 인라인 링크, 주변 간격이 충분한 경우는 WCAG 2.5.8 예외일 수 있음');
  console.table(rows); return rows;
})();
