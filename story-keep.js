import { t } from './i18n.js?v=eb-20260914w';

const ACTS = [
  { num: '01', en: 'SOULTRACE', verb: 'RECORD', title: 'sk.a1.title', lead: 'sk.a1.lead' },
  { num: '02', en: 'NFC MEMORY CARD', verb: 'KEEP', title: 'sk.a2.title', lead: 'sk.a2.lead' },
  { num: '03', en: 'ETERNAL BEAM', verb: 'EXPERIENCE', title: 'sk.a3.title', lead: 'sk.a3.lead' },
];

const PET_V = 'eb-20260914v';
const PETS = [
  ...Array.from({ length: 36 }, (_, i) => `assets/journey/pets/p${String(i + 1).padStart(2, '0')}.webp?v=${PET_V}`),
  `assets/journey/pets/shiba.webp?v=eb-20260914s`,
  `assets/journey/pets/beagle.webp?v=eb-20260914s`,
  `assets/journey/pets/husky.webp?v=eb-20260914s`,
  `assets/journey/pets/retriever.webp?v=eb-20260914s`,
  `assets/journey/pets/puppy.webp?v=eb-20260914s`,
  `assets/journey/pets/tabby.webp?v=eb-20260914s`,
  `assets/journey/pets/black-cat.webp?v=eb-20260914s`,
  `assets/journey/pets/grey-cat.webp?v=eb-20260914s`,
];

function motionOff() {
  return document.documentElement.classList.contains('reduced-motion')
    || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initAlbum(section) {
  const album = section.querySelector('.sk-album');
  const card = section.querySelector('.sk-card');
  if (!album) return;
  album.replaceChildren();

  const LANES = [
    { through: true, x: .5, w: .2 },
    { through: false, x: .13, w: .15 },
    { through: false, x: .87, w: .15 },
  ];
  const pool = PETS.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let cursor = 0;
  const recent = [];

  function nextSrc() {
    let src;
    let guard = 0;
    do {
      src = pool[cursor % pool.length];
      cursor += 1;
      guard += 1;
    } while (recent.includes(src) && guard < pool.length);
    recent.push(src);
    if (recent.length > 12) recent.shift();
    return src;
  }

  const nodes = LANES.map((lane, index) => {
    const fig = document.createElement('figure');
    fig.className = 'sk-float';
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    fig.append(img);
    album.append(fig);
    return { fig, img, lane, index };
  });

  function spawn(item, first) {
    item.img.src = nextSrc();
    item.through = item.lane.through;
    item.x = item.lane.x;
    item.w = item.lane.w;
    item.speed = .0017;
    item.rot = item.through ? 0 : (item.index === 1 ? -5 : 5);
    item.phase = item.index * 1.7;
    item.amp = item.through ? 0 : .012;
    item.spin = 0;
    item.y = first ? .12 + item.index * .38 : 1.22;
  }

  nodes.forEach((node) => spawn(node, true));

  let raf = 0;
  let last = 0;

  function paint(item, aw, ah, x, w) {
    item.fig.style.width = `${w}px`;
    item.fig.style.transform = `translate3d(${x * aw - w / 2}px, ${item.y * ah}px, 0) rotate(${item.rot}deg)`;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const aw = album.clientWidth || 1;
    const ah = album.clientHeight || 1;
    if (motionOff()) {
      nodes.forEach((item) => {
        item.y = item.through ? .32 : item.index === 1 ? .18 : .55;
        item.phase = 0;
        item.amp = 0;
        paint(item, aw, ah, item.x, Math.max(140, item.w * aw));
      });
      return;
    }
    if (section.dataset.act !== '2') return;
    const dt = Math.min(40, now - last || 16) / 16.67;
    last = now;
    const cr = card ? card.getBoundingClientRect() : null;
    const ar = album.getBoundingClientRect();
    const cardMid = cr ? (cr.left + cr.width / 2 - ar.left) / aw : .5;
    const cardTop = cr ? (cr.top - ar.top) / ah : .28;
    const cardBot = cr ? (cr.bottom - ar.top) / ah : .72;
    const slotW = cr ? cr.width * .72 : aw * .2;

    for (const item of nodes) {
      item.y -= item.speed * dt;
      item.phase += .008 * dt;
      if (item.y < -.45) spawn(item, false);
      let x = item.x + Math.sin(item.phase) * item.amp;
      let w = Math.max(140, item.w * aw);
      if (item.through && item.y + .4 > cardTop && item.y < cardBot) {
        x += (cardMid - x) * .2;
        w += (slotW - w) * .18;
      }
      paint(item, aw, ah, x, w);
    }
  }

  raf = requestAnimationFrame(frame);
  addEventListener('eb:motion', () => { last = 0; });
}

export function initStoryKeep() {
  const section = document.querySelector('#original.story-keep');
  if (!section) return;

  const num = section.querySelector('[data-sk-num]');
  const en = section.querySelector('[data-sk-en]');
  const verb = section.querySelector('[data-sk-verb]');
  const title = section.querySelector('[data-sk-title]');
  const lead = section.querySelector('[data-sk-lead]');
  const steps = [...section.querySelectorAll('[data-sk-jump]')];
  let act = 1;
  let playToken = 0;
  let seen = false;

  function writeCopy(next) {
    const row = ACTS[next - 1];
    if (!row) return;
    if (num) num.textContent = row.num;
    if (en) en.textContent = row.en;
    if (verb) verb.textContent = row.verb;
    if (title) title.textContent = t(row.title);
    if (lead) lead.textContent = t(row.lead);
    steps.forEach((btn, i) => {
      if (i === next - 1) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  function play(next, restart = true) {
    act = next;
    section.dataset.act = String(act);
    section.dataset.dark = act === 3 ? 'on' : '';
    section.dataset.space = act === 3 ? 'on' : '';
    writeCopy(act);
    if (!restart) return;
    section.classList.remove('is-playing');
    void section.offsetWidth;
    playToken += 1;
    section.dataset.play = String(playToken);
    section.classList.add('is-playing');
  }

  steps.forEach((btn) => {
    btn.addEventListener('click', () => play(Number(btn.dataset.skJump), true));
  });

  addEventListener('eb:lang', () => writeCopy(act));

  const watch = new IntersectionObserver((entries) => {
    const on = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > .35);
    if (!on) return;
    if (!seen) {
      seen = true;
      play(1, !document.documentElement.classList.contains('reduced-motion'));
    }
  }, { threshold: [.35] });
  watch.observe(section);

  initAlbum(section);
  play(1, false);
}
