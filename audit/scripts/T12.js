// T12. 더미 링크·깨진 앵커·내부 링크 상태 (L4)
// audit/PROMPT.md 부록 A 원문
(async () => {
  const anchors = [...document.querySelectorAll('a')];
  const 더미링크 = anchors.filter(a => { const h = a.getAttribute('href'); return h === null || ['', '#'].includes(h.trim()) || /^javascript:/i.test(h); }).map(a => a.outerHTML.slice(0, 90));
  const 깨진앵커 = anchors.filter(a => { const h = a.getAttribute('href') || ''; if (!h.includes('#') || h.trim() === '#') return false; const u = new URL(a.href); return u.origin + u.pathname === location.origin + location.pathname && u.hash.length > 1 && !document.getElementById(decodeURIComponent(u.hash.slice(1))); }).map(a => a.getAttribute('href'));
  const urls = [...new Set(anchors.map(a => a.href.split('#')[0]).filter(h => /^https?:/.test(h)))];
  const 내부 = urls.filter(h => h.startsWith(location.origin)), 외부 = urls.filter(h => !h.startsWith(location.origin));
  const 상태 = [];
  for (const h of 내부) { try { const r = await fetch(h, { method: 'HEAD' }); 상태.push({ 링크: h.replace(location.origin, '') || '/', 코드: r.status, 판정: r.ok ? '✅' : '❌' }); } catch { 상태.push({ 링크: h, 코드: '요청 실패', 판정: '❓' }); } }
  상태.sort((a, b) => a.판정.localeCompare(b.판정));
  console.log('더미·빈 링크:', 더미링크); console.log('대상 없는 앵커:', 깨진앵커); console.table(상태); console.log('외부 링크 (직접 확인):', 외부);
  return { 더미링크, 깨진앵커, 상태, 외부 };
})();
