// T3. 스타일 고유값 빈도표 (B4, C6, D1, F3, G6, 디자인 시스템 제안)
// audit/PROMPT.md 부록 A 원문
(() => {
  const M = { 글꼴조합: {}, 글자크기: {}, 글자색: {}, 배경색: {}, 간격: {}, radius: {}, 그림자: {}, zIndex: {}, CSS전환: {}, CSS_easing: {} };
  const add = (m, k) => { m[k] = (m[k] || 0) + 1; };
  for (const el of document.body.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (s.display === 'none') continue;
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      add(M.글꼴조합, `${s.fontFamily.split(',')[0].replace(/["']/g, '')} ${s.fontSize}/${s.lineHeight} w${s.fontWeight} 자간 ${s.letterSpacing}`);
      add(M.글자크기, s.fontSize); add(M.글자색, s.color);
    }
    for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      if (!['0px', 'normal', 'auto', ''].includes(s[p])) add(M.간격, s[p]);
    }
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') add(M.배경색, s.backgroundColor);
    if (s.borderRadius !== '0px') add(M.radius, s.borderRadius);
    if (s.boxShadow !== 'none') add(M.그림자, s.boxShadow);
    if (s.zIndex !== 'auto') add(M.zIndex, s.zIndex);
    if (s.transitionDuration.split(',').some(d => parseFloat(d) > 0)) { add(M.CSS전환, `${s.transitionProperty} ${s.transitionDuration}`); add(M.CSS_easing, s.transitionTimingFunction); }
  }
  const out = {};
  for (const [k, m] of Object.entries(M)) {
    out[k] = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([값, 개수]) => ({ 값, 개수 }));
    console.log(`▶ ${k}: 고유값 ${out[k].length}개`); console.table(out[k].slice(0, 40));
  }
  out.실행중애니메이션 = document.getAnimations().map(a => { const t = a.effect?.getTiming?.() || {}, tg = a.effect?.target; return { 대상: tg ? tg.tagName.toLowerCase() + (typeof tg.className === 'string' && tg.className ? '.' + tg.className.split(' ')[0] : '') : '-', 종류: a.constructor.name, 이름: a.animationName || a.transitionProperty || a.id || '-', duration: t.duration, easing: t.easing, 반복: t.iterations }; });
  console.log('▶ 현재 실행 중인 CSS/WAAPI 애니메이션 (GSAP 등 JS 트윈은 여기 안 잡힘)'); console.table(out.실행중애니메이션);
  return out;
})();
