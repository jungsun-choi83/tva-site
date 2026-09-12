// T8. 숨었는데 포커스 가능한 요소 (M7, H7, J32)
// audit/PROMPT.md 부록 A 원문
(() => {
  const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, iframe, [tabindex]:not([tabindex^="-"]), [contenteditable]:not([contenteditable=false])';
  const label = el => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const why = el => {
    if (el.closest('[inert]')) return '';
    for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') return ''; }
    if (el.closest('[aria-hidden="true"]')) return '❌ aria-hidden 내부인데 포커스 가능';
    for (let p = el; p; p = p.parentElement) if (+getComputedStyle(p).opacity === 0) return `❌ 투명(opacity 0) 조상: ${label(p)}`;
    const r = el.getBoundingClientRect();
    if (r.right <= 0 || r.left >= innerWidth) return '⚠️ 화면 좌우 밖 (닫힌 메뉴·숨은 슬라이드?)';
    if (r.width <= 1 && r.height <= 1) return '⚠️ 크기 0 (sr-only 본문바로가기라면 정상)';
    return '';
  };
  const rows = [...document.querySelectorAll(sel)].map(el => ({ 문제: why(el), 요소: label(el), 텍스트: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30), html: el.outerHTML.slice(0, 90) })).filter(r => r.문제);
  console.table(rows); return rows;
})();
