// T7. LCP·CLS·긴 프레임·느린 상호작용·큰 리소스 (N2~N5)
// audit/PROMPT.md 부록 A 원문
(() => {
  const label = n => n ? n.nodeName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/)[0] : '') : '?';
  const log = window.__auditPerf = { LCP: [], CLS누적: 0, 레이아웃이동: [], 긴프레임: [], 느린상호작용: [] };
  const obs = (type, cb) => { try { new PerformanceObserver(l => l.getEntries().forEach(cb)).observe({ type, buffered: true }); } catch { console.log(`${type}: 이 브라우저 미지원`); } };
  obs('largest-contentful-paint', e => { log.LCP.push({ ms: Math.round(e.startTime), 요소: label(e.element), url: e.url || '' }); console.log(`LCP 후보 ${Math.round(e.startTime)}ms`, label(e.element), e.url || ''); });
  obs('layout-shift', e => { if (e.hadRecentInput) return; log.CLS누적 += e.value; const src = (e.sources || []).map(s => label(s.node)); log.레이아웃이동.push({ 값: +e.value.toFixed(4), ms: Math.round(e.startTime), 요소: src.join(', ') }); console.log(`CLS +${e.value.toFixed(4)} (누적 ${log.CLS누적.toFixed(4)})`, src); });
  obs('long-animation-frame', e => { if (e.duration < 100) return; const sc = (e.scripts || []).slice(0, 3).map(s => `${(s.sourceURL || '').split('/').pop()} ${s.sourceFunctionName || s.invoker || ''}`); log.긴프레임.push({ ms: Math.round(e.duration), 차단ms: Math.round(e.blockingDuration || 0), 스크립트: sc.join(' | ') }); console.log(`긴 프레임 ${Math.round(e.duration)}ms`, sc); });
  obs('event', e => { if (e.duration < 200) return; log.느린상호작용.push({ 이벤트: e.name, ms: Math.round(e.duration), 대상: label(e.target) }); console.log(`느린 상호작용 ${e.name} ${Math.round(e.duration)}ms`, label(e.target)); });
  const nav = performance.getEntriesByType('navigation')[0];
  const 로딩 = nav ? { TTFB_ms: Math.round(nav.responseStart), DOMContentLoaded_ms: Math.round(nav.domContentLoadedEventEnd), load_ms: Math.round(nav.loadEventEnd), HTML_KB: Math.round(nav.transferSize / 1024) } : {};
  const 큰리소스 = performance.getEntriesByType('resource').sort((a, b) => b.transferSize - a.transferSize).slice(0, 15).map(r => ({ 파일: r.name.split('/').pop().split('?')[0].slice(0, 50), 종류: r.initiatorType, KB: Math.round(r.transferSize / 1024), ms: Math.round(r.duration) }));
  console.table(로딩); console.log('전송량 큰 리소스 (교차 출처·캐시는 0KB로 보일 수 있음)'); console.table(큰리소스);
  console.log('관찰 중: 스크롤·클릭 후 window.__auditPerf 를 다시 출력하세요.');
  return { 로딩, 큰리소스 };
})();
