import { createSofaJourneyScene } from './sofa-journey/scene.js?v=eb-20260914';

export function initSignalPassage(mount) {
  if (!mount) throw new Error('initSignalPassage requires a drop-stage mount.');
  if (mount.__signalPassage) return mount.__signalPassage;
  const passage = document.createElement('div');
  passage.className = 'signal-passage';
  mount.prepend(passage); mount.closest('#drop')?.classList.add('signal-passage-ready');
  let queued = 0; let last = null;
  let scene;
  const isVisible = () => {
    if (document.hidden || !passage.isConnected) return false;
    const rect = passage.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  };
  const wake = () => {
    if (queued || !isVisible()) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      if (last && isVisible()) scene.draw({ ...last, nowMs: performance.now() });
    });
  };
  scene = createSofaJourneyScene(passage, wake);
  function draw(progress = 0, pointer = {}, reduced = false, aperture = null, bridgeProgress = 1) {
    last = { progress, pointer, reduced, aperture, bridgeProgress, nowMs: performance.now() }; scene.draw(last);
  }
  function resize() { scene.resize(); if (last) scene.draw({ ...last, nowMs: performance.now() }); }
  function setPortalActive(active, host = document.body) {
    const parent = active ? host : mount;
    if(passage.parentElement !== parent) parent.append(passage);
    passage.classList.toggle('is-home-bridge', active);
    passage.classList.toggle('is-stage-bridge', active && host !== document.body);
  }
  const api = {
    draw,
    drawArrival: scene.drawArrival,
    resize,
    setPortalActive,
    getCharacterRect: scene.getCharacterRect,
    setCharacterHidden: scene.setCharacterHidden,
    setHandoffProgress: scene.setHandoffProgress,
    dispose() { cancelAnimationFrame(queued); scene.dispose(); passage.remove(); }
  };
  mount.__signalPassage = api; return api;
}
