// Signal veil — the HOME screen's broadcast texture (scan lines 3px period at 20%, soft grain, dark edges, a faint
// cream/cyan fringe) carried over the fall as one fixed layer, driven by a single "signal strength" value 0..1.
// The scene sets the value while it owns the screen; after the sofa the veil fades itself out across the next section.
const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));
export function installSignalVeil(doc = document) {
  const existing = doc.querySelector('.signal-veil');
  if (existing) return existing.__api;
  const el = doc.createElement('div');
  el.className = 'signal-veil';
  el.innerHTML = '<i class="signal-veil__fringe"></i><i class="signal-veil__scan"></i><i class="signal-veil__grain"></i><i class="signal-veil__vignette"></i><i class="signal-veil__flash"></i>';
  doc.body.append(el);
  let strength = 0, glitch = 0, landingStrength = 0, sceneOwns = true;
  const reduced = () => doc.documentElement.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  function apply() {
    const v = reduced() ? 0 : strength, g = reduced() ? 0 : glitch;
    el.style.setProperty('--signal', v.toFixed(3));
    el.style.setProperty('--glitch', g.toFixed(3));
    el.style.opacity = v > .002 ? '1' : '0';
    el.dataset.signal = v.toFixed(3);
  }
  function set(v, g = 0) { strength = clamp(v); glitch = clamp(g); apply(); }
  function setLanding(v) { landingStrength = clamp(v); }
  // after the drop section the veil clears itself over the next 1.6 screens
  function onScroll() {
    const drop = doc.querySelector('#drop'); if (!drop) return;
    const end = drop.offsetTop + drop.offsetHeight - innerHeight;
    if (scrollY <= end + 2) { sceneOwns = true; return; }
    sceneOwns = false;
    const t = clamp((scrollY - end) / (innerHeight * 1.6));
    strength = landingStrength * (1 - t * t); glitch = 0; apply();
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  const api = { set: (v, g) => { if (sceneOwns) set(v, g); }, setLanding, get strength() { return strength; }, element: el };
  el.__api = api;
  return api;
}
