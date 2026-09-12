// T10. 프레임 측정 (E34, F12, J27)
// audit/PROMPT.md 부록 A 원문
(() => {
  const DUR = 6000, d = []; let last, t0;
  const report = () => {
    const s = [...d].sort((a, b) => a - b), med = s[Math.floor(s.length / 2)], hz = Math.round(1000 / med), avg = d.reduce((a, b) => a + b, 0) / d.length;
    const r = { 추정주사율Hz: hz, 평균fps: +(1000 / avg).toFixed(1), p95프레임ms: +s[Math.floor(s.length * 0.95)].toFixed(1), 최악프레임ms: +s.at(-1).toFixed(1), 끊긴프레임수: d.filter(x => x > med * 1.5).length, 총프레임: d.length };
    window.__auditFrames = r; console.table(r);
  };
  const tick = t => { d.push(t - last); last = t; t - t0 < DUR ? requestAnimationFrame(tick) : report(); };
  requestAnimationFrame(t => { last = t0 = t; requestAnimationFrame(tick); });
  console.log('지금부터 6초 동안 측정할 구간을 스크롤·조작하세요. 결과: console 및 window.__auditFrames');
})();
