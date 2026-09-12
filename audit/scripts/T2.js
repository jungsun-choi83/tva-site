// T2. 가로 넘침 요소 찾기 (B13, J1)
// audit/PROMPT.md 부록 A 원문
(() => {
  const W = document.documentElement.clientWidth;
  const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const context = el => { for (let p = el; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.position === 'fixed') return '고정요소(fixed) 내부'; if (p !== el && s.overflowX !== 'visible') return `부모에서 잘림: ${label(p)}`; } return '❌ 잘리지 않음'; };
  const rows = [...document.body.querySelectorAll('*')]
    .map(el => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width && (r.right > W + 0.5 || r.left < -0.5))
    .map(({ el, r }) => ({ 요소: label(el), left: Math.round(r.left), right: Math.round(r.right), 넘침px: Math.round(Math.max(r.right - W, -r.left)), 상황: context(el) }));
  const extra = document.documentElement.scrollWidth - W;
  console.log(`창 폭 ${W}px / 문서 가로 스크롤: ${extra > 0 ? `❌ 있음 (${extra}px)` : '✅ 없음'}`);
  console.table(rows); return { 가로스크롤px: Math.max(0, extra), rows };
})();
