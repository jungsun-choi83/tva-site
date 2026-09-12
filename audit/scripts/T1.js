// T1. 환경·기술 스택 감지 (단계 1)
// audit/PROMPT.md 부록 A 원문
(() => {
  const html = document.documentElement, cs = getComputedStyle(html), bs = getComputedStyle(document.body), mq = q => matchMedia(q).matches;
  const r = {
    URL: location.href, 뷰포트: `${innerWidth}×${innerHeight}`, 스크롤바폭: innerWidth - html.clientWidth, DPR: devicePixelRatio,
    정밀포인터_hover: mq('(hover: hover) and (pointer: fine)'), 터치포인터존재: mq('(any-pointer: coarse)'),
    reducedMotion: mq('(prefers-reduced-motion: reduce)'), 다크모드: mq('(prefers-color-scheme: dark)'),
    Lenis: html.classList.contains('lenis') || !!window.lenis || !!window.__lenis,
    Lenis클래스: [...html.classList].filter(c => c.startsWith('lenis')).join(' ') || '-',
    Locomotive_v4: !!document.querySelector('[data-scroll-container]'),
    GSAP: window.gsap?.version || '-', ScrollTrigger개수: window.ScrollTrigger?.getAll?.().length ?? '-',
    ScrollSmoother: !!window.ScrollSmoother?.get?.(), Three: window.THREE?.REVISION || '-',
    프레임워크: (window.__NEXT_DATA__ || self.__next_f || document.querySelector('#__next')) ? 'Next.js'
      : window.__NUXT__ ? 'Nuxt' : document.querySelector('astro-island, [data-astro-cid]') ? 'Astro'
      : document.querySelector('[ng-version]') ? 'Angular' : '-',
    CSS_scrollBehavior: cs.scrollBehavior, CSS_scrollSnap: cs.scrollSnapType, scrollRestoration: history.scrollRestoration,
    html_overflow: `${cs.overflowX}/${cs.overflowY}`, body_overflow: `${bs.overflowX}/${bs.overflowY}`,
    viewportMeta: document.querySelector('meta[name=viewport]')?.content || '❌ 없음',
    lang: html.lang || '❌ 없음', colorScheme: cs.colorScheme,
    iframe: document.querySelectorAll('iframe').length, video: document.querySelectorAll('video').length, canvas: document.querySelectorAll('canvas').length,
    문서높이: html.scrollHeight
  };
  console.table(r); return r;
})();
