// T9. 휠 입력 반응 측정 (E3~E9)
// audit/PROMPT.md 부록 A 원문
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const maxY = () => document.documentElement.scrollHeight - innerHeight;
  const startY = Math.max(0, Math.min(200, maxY() - 1200));
  const jump = y => window.lenis?.scrollTo ? window.lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y);
  const wheel = (dy, mode = 0) => (document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body).dispatchEvent(new WheelEvent('wheel', { deltaY: dy, deltaMode: mode, bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight / 2 }));
  const series = (n, gap, f) => () => { let i = 0; const id = setInterval(() => { wheel(...f(i)); if (++i >= n) clearInterval(id); }, gap); };
  const record = async (테스트, fire, ms = 1500) => {
    jump(startY); await sleep(900);
    const y0 = scrollY, t0 = performance.now(), s = [];
    fire();
    await new Promise(done => { const tick = () => { const t = performance.now() - t0; s.push([t, scrollY - y0]); t < ms ? requestAnimationFrame(tick) : done(); }; requestAnimationFrame(tick); });
    const total = s.at(-1)[1], start = s.find(p => Math.abs(p[1]) > 0.5)?.[0], t90 = s.find(p => Math.abs(p[1]) >= Math.abs(total) * 0.9)?.[0];
    let stop = null; for (let i = s.length - 1; i > 0; i--) if (Math.abs(s[i][1] - s[i - 1][1]) > 0.5) { stop = s[i][0]; break; }
    return { 테스트, 총이동px: Math.round(total), 반응시작ms: start != null ? Math.round(start) : '무반응', '90%도달ms': total ? Math.round(t90) : '-', 멈춤ms: stop != null ? Math.round(stop) : '-', 끝에닿음: scrollY >= maxY() - 1 ? '⚠️ 값 잘림' : '' };
  };
  const rows = [];
  rows.push(await record('일반 마우스 1칸 (deltaY 100)', () => wheel(100)));
  rows.push(await record('마우스 3칸 연속 (100×3, 60ms 간격)', series(3, 60, () => [100])));
  rows.push(await record('Firefox 줄 단위 1칸 (deltaMode 1, 3줄)', () => wheel(3, 1)));
  rows.push(await record('트랙패드 플릭 (감쇠하는 작은 delta 30회)', series(30, 16, i => [Math.max(1, Math.round(40 * Math.exp(-i / 8)))]), 2000));
  rows.push(await record('고해상도 휠 (deltaY 4 × 25회)', series(25, 8, () => [4])));
  console.table(rows);
  console.log('주의: 합성 이벤트(isTrusted=false)는 네이티브 스크롤을 움직이지 않습니다. 전부 "무반응"이면 네이티브 스크롤이거나 라이브러리가 isTrusted를 검사하는 것 → 자동화 도구의 실제 휠 입력(예: Playwright mouse.wheel)이나 사람 테스트로 재측정.');
  return rows;
})();
