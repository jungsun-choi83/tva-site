// 화면 아래 작은 "스크롤" 안내: 멈춰 있을 때만 뜨고, 움직이거나 맨 끝이면 숨는다.
// 첫 화면에는 원래 있던 "SCROLL TO ENTER"가 있으므로 그 구간에서는 띄우지 않는다.
const cue = document.createElement('div');
cue.className = 'scroll-cue';
cue.setAttribute('aria-hidden', 'true');
cue.innerHTML = '<span class="scroll-cue__label">SCROLL</span><i class="scroll-cue__arrow"></i>';
document.body.appendChild(cue);

const hero = document.getElementById('home');
// 이미 자기 안내가 있는 구역(어바웃의 SCROLL TO EXPLORE, 문의 폼, 마지막 화면)에서는 겹치지 않게 비운다
// 모바일 포트폴리오는 캐릭터와 OUR WORKS가 아래를 차지하므로 스크롤 표시를 뺀다 (2026-09-10 A안)
const quietIds = ['about', 'contact', ...(innerWidth <= 760 ? ['portfolio'] : [])];
const quiet = quietIds.map(id => document.getElementById(id)).filter(Boolean);
let moving = false, idleTimer = 0, raf = 0;

function heroZone() {
  if (!hero) return 0;
  return hero.offsetTop + hero.offsetHeight - window.innerHeight * 0.75;
}

function update() {
  raf = 0;
  const doc = document.documentElement;
  const nearEnd = window.scrollY + window.innerHeight > doc.scrollHeight - 140;
  const inHero = window.scrollY < heroZone();
  const inQuiet = quiet.some(el => { const r = el.getBoundingClientRect(); return Math.min(r.bottom, innerHeight) - Math.max(r.top, 0) > innerHeight * 0.5; });
  cue.classList.toggle('is-on', !moving && !nearEnd && !inHero && !inQuiet);
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(update);
}

window.addEventListener('scroll', () => {
  moving = true;
  schedule();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { moving = false; schedule(); }, 850);
}, { passive: true });

window.addEventListener('resize', schedule, { passive: true });
setTimeout(schedule, 600);
