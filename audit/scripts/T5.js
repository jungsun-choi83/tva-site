// T5. 이미지 품질·용량·속성 (K1~K5, N3)
// audit/PROMPT.md 부록 A 원문
(() => {
  const dpr = devicePixelRatio;
  const imgs = [...document.images].map(img => {
    const r = img.getBoundingClientRect(), fit = getComputedStyle(img).objectFit, need = Math.round(r.width * dpr);
    let 판정 = 'OK';
    if (!img.complete || !img.naturalWidth) 판정 = '미로딩(lazy일 수 있음, 스크롤 후 재실행)';
    else if (!r.width) 판정 = '숨김';
    else if (img.naturalWidth < need * 0.9) 판정 = `⚠️ 흐림 가능 (필요 약 ${need}px)`;
    else if (img.naturalWidth > need * 2.5) 판정 = `⚠️ 과대 (필요 약 ${need}px)`;
    const 왜곡 = fit === 'fill' && img.naturalWidth && r.height && Math.abs((r.width / r.height) / (img.naturalWidth / img.naturalHeight) - 1) > 0.02 ? '❌ 비율 왜곡' : '-';
    const 첫화면 = r.top < innerHeight && r.bottom > 0 && r.width > 0;
    return {
      파일: (img.currentSrc || img.src).split('/').pop().split('?')[0].slice(0, 40), 표시: `${Math.round(r.width)}×${Math.round(r.height)}`, 원본: `${img.naturalWidth}×${img.naturalHeight}`,
      판정, 왜곡, objectFit: fit, alt: img.hasAttribute('alt') ? (img.alt ? img.alt.slice(0, 20) : '(빈 alt: 장식)') : '❌ 없음',
      크기속성: img.hasAttribute('width') && img.hasAttribute('height') ? 'O' : '❌', loading: img.loading,
      첫화면: 첫화면 ? (img.loading === 'lazy' ? '⚠️ 첫화면인데 lazy' : '예') : '', fetchpriority: img.getAttribute('fetchpriority') || '-'
    };
  });
  const bgs = [...new Set([...document.body.querySelectorAll('*')].map(el => getComputedStyle(el).backgroundImage).filter(b => b.includes('url(')))].map(b => b.slice(0, 120));
  console.log('object-fit: cover 이미지는 크롭 비율만큼 더 큰 원본이 필요할 수 있음');
  console.table(imgs); console.log('CSS 배경 이미지 (해상도 별도 확인):', bgs);
  return { imgs, bgs };
})();
