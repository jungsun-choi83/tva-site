// T11. 텍스트 대비 (D2, D3)
// audit/PROMPT.md 부록 A 원문
(() => {
  const parse = c => { const m = c.match(/^rgba?\(([^)]+)\)$/); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const background = el => {
    const layers = [];
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.backgroundImage !== 'none') return { unknown: '배경 이미지·그라디언트 위' };
      const c = parse(s.backgroundColor); if (!c) return { unknown: '해석 불가 색 형식' };
      if (c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg);
    return { bg };
  };
  const rows = [], seen = new Set(), order = { '❌': 0, '❓': 1, '✅': 2 };
  for (const el of document.body.querySelectorAll('*')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el); if (!el.getBoundingClientRect().width || s.visibility === 'hidden') continue;
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30), size = parseFloat(s.fontSize), large = size >= 24 || (+s.fontWeight >= 700 && size >= 18.66);
    let fg = parse(s.color); const { bg, unknown } = background(el);
    if (!fg || unknown) { const k = `?${unknown}|${s.color}`; if (!seen.has(k)) { seen.add(k); rows.push({ 판정: '❓', 비율: '-', 기준: '-', 텍스트: text, 크기: s.fontSize, 글자색: s.color, 배경: unknown || '글자색 형식 해석 불가' }); } continue; }
    if (fg.a < 1) fg = blend(fg, bg);
    const k = `${s.color}|${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}|${large}`; if (seen.has(k)) continue; seen.add(k);
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), need = large ? 3 : 4.5;
    rows.push({ 판정: ratio >= need ? '✅' : '❌', 비율: +ratio.toFixed(2), 기준: need, 텍스트: text, 크기: s.fontSize, 글자색: s.color, 배경: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})` });
  }
  rows.sort((a, b) => order[a.판정] - order[b.판정]);
  console.log('한계: 조상 배경색 기준 추정치. 절대위치로 겹친 요소·opacity·이미지 위 텍스트는 스크린샷으로 별도 확인 (❓)');
  console.table(rows); return rows;
})();
