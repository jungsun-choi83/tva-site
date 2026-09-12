const instances = new WeakMap();
let sequence = 0;

const operatorSource = new URL('./gallery-original/assets/character/portfolio-operator.png', import.meta.url).href;
const runSource = new URL('./assets/character-run.webp', import.meta.url).href;
const styleSource = new URL('./index-character.css?v=index-20260907-r1.h0f79f647', import.meta.url).href;
const categoryNames = ['BRAND', 'CAMPAIGN', 'MEDIA', 'EXPERIENCE'];

function folderLayer(className, transform) {
  return `<g class="${className}" transform="${transform}">
    <path class="index-character__paper-back" vector-effect="non-scaling-stroke" d="M7 18a4 4 0 0 1 4-4h13l5 6h24a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4Z"/>
    <path class="index-character__paper-tab" vector-effect="non-scaling-stroke" d="M8 18a3 3 0 0 1 3-3h12l5 5H8Z"/>
    <path class="index-character__paper-sheet" vector-effect="non-scaling-stroke" d="M17 14h32v28H17Z"/>
    <path class="index-character__paper-front" vector-effect="non-scaling-stroke" d="M7 24h50l-3 18a4 4 0 0 1-4 3H11a4 4 0 0 1-4-4Z"/>
    <path class="index-character__paper-seam" vector-effect="non-scaling-stroke" d="M9 27h45"/>
  </g>`;
}

function loadStylesheet(ownerDocument) {
  if (ownerDocument.querySelector('link[data-index-character-style]')) return;
  const link = ownerDocument.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleSource;
  link.dataset.indexCharacterStyle = '';
  ownerDocument.head.append(link);
}

function categoryCard(name, index) {
  const number = String(index + 1).padStart(2, '0');
  return `<g class="index-character__divider" data-index-category="${index}">
    <rect class="index-character__divider-paper" width="112" height="76" rx="2" />
    <path class="index-character__divider-tab" d="M8 0h42l10 12H8Z" />
    <path class="index-character__divider-rule" d="M9 51h94M9 59h68" />
    <text class="index-character__divider-number" x="9" y="24">${number}</text>
    <text class="index-character__divider-label" x="9" y="43">${name}</text>
  </g>`;
}

function characterMarkup(id) {
  const cards = categoryNames.map(categoryCard).join('');
  return `<svg class="character-rig index-character" viewBox="0 0 768 682" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <image id="${id}-operator" href="${operatorSource}" width="768" height="682" />
      <image id="${id}-run" href="${runSource}" width="1254" height="1254" />
      <filter id="${id}-mono" color-interpolation-filters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer><feFuncR type="gamma" amplitude="1.18" exponent="1.35" offset="-.04"/><feFuncG type="gamma" amplitude="1.18" exponent="1.35" offset="-.04"/><feFuncB type="gamma" amplitude="1.18" exponent="1.35" offset="-.04"/></feComponentTransfer>
      </filter>
      <clipPath id="${id}-eyes"><path d="M304 151c4-42 24-67 45-62 23 5 35 36 27 75-7 39-25 62-47 57-21-5-29-34-25-70Zm88-2c5-41 26-65 47-59 23 6 33 37 25 76-8 38-27 60-48 54-22-6-29-35-24-71Z"/></clipPath>
      <clipPath id="${id}-left-hand"><path d="M39 260c7-27 31-36 58-21 7-29 34-35 53-13 8 9 12 22 12 34 20-11 42 3 42 25 0 30-31 57-66 66-41 10-91-3-104-35-8-20-5-41 5-56Z"/></clipPath>
      <clipPath id="${id}-right-hand"><path d="M548 245c7-20 22-31 39-28 27 5 42 33 38 64-5 36-28 65-53 61-27-5-43-40-34-72 2-10 6-18 10-25Z"/></clipPath>
      <clipPath id="${id}-left-foot"><path d="M250 960c10-55 58-88 112-76 39 9 57 43 82 69 22 23 62 36 72 78 14 57-33 116-99 127H302c-59-11-91-69-65-121 10-20 9-55 13-77Z"/></clipPath>
      <g id="${id}-folder-paper">
        <!-- Exact body paths reused from the current gallery folder icon. -->
        <path class="index-character__paper-back" d="M7 18a4 4 0 0 1 4-4h13l5 6h24a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4Z"/>
        <path class="index-character__paper-tab" d="M8 18a3 3 0 0 1 3-3h12l5 5H8Z"/>
        <path class="index-character__paper-sheet" d="M17 14h32v28H17Z"/>
        <path class="index-character__paper-front" d="M7 24h50l-3 18a4 4 0 0 1-4 3H11a4 4 0 0 1-4-4Z"/>
        <path class="index-character__paper-seam" d="M9 27h45"/>
      </g>
    </defs>
    <g class="index-character__stage">
      <ellipse class="index-character__shadow" cx="386" cy="572" rx="156" ry="18"/>
      <g class="index-character__legs"><path class="index-character__limb-outline" d="M320 397Q306 447 302 503M448 397Q466 447 495 497"/><path class="index-character__limb" d="M320 397Q306 447 302 503M448 397Q466 447 495 497"/></g>
      <g class="index-character__feet index-character__feet--left" filter="url(#${id}-mono)"><g transform="translate(100 96) scale(.42)"><use href="#${id}-run" clip-path="url(#${id}-left-foot)"/></g></g>
      <g class="index-character__feet index-character__feet--right" filter="url(#${id}-mono)"><g transform="translate(650 96) scale(-.42 .42)"><use href="#${id}-run" clip-path="url(#${id}-left-foot)"/></g></g>
      <g class="index-character__stack">${cards}</g>
      <g class="index-character__body-group">
        ${folderLayer('index-character__paper-layer--shadow', 'translate(143 -7) scale(7.5 9.6875)')}
        ${folderLayer('index-character__paper-layer', 'translate(132 -19) scale(7.5 9.6875)')}
        <path class="index-character__fold" d="m512 388 49-5-9 48Z"/>
        <path class="index-character__registration" d="m254 365 18 0m-9-9v18"/>
        <g transform="translate(0 44)"><g class="index-character__eyes" clip-path="url(#${id}-eyes)"><use href="#${id}-operator"/></g></g>
        <path class="index-character__mouth" d="M358 269q28 17 57-3"/>
        <g class="index-character__left-arm">
          <path class="index-character__limb-outline" d="M241 278Q194 279 161 309"/>
          <path class="index-character__limb" d="M241 278Q194 279 161 309"/>
          <g class="index-character__left-hand" filter="url(#${id}-mono)" clip-path="url(#${id}-left-hand)"><use href="#${id}-operator"/></g>
        </g>
        <g class="index-character__right-arm">
          <path class="index-character__limb-outline" d="M531 260Q564 252 590 281"/>
          <path class="index-character__limb" d="M531 260Q564 252 590 281"/>
          <g class="index-character__right-hand" filter="url(#${id}-mono)" clip-path="url(#${id}-right-hand)"><use href="#${id}-operator"/></g>
        </g>
      </g>
    </g>
  </svg>`;
}

export function createIndexCharacter(mount) {
  const existing = instances.get(mount);
  if (existing) return existing;
  loadStylesheet(mount.ownerDocument);
  const id = `index-character-${++sequence}`;
  mount.insertAdjacentHTML('beforeend', characterMarkup(id));
  mount.dataset.indexCharacter = '';
  mount.dataset.indexReady = '';
  const svg = mount.querySelector('.index-character');
  const stage = svg.querySelector('.index-character__stage');
  const cards = [...svg.querySelectorAll('[data-index-category]')];
  let category = 0;
  let poseToken = 0;
  let settleTimer = 0;

  const reduced = () => mount.ownerDocument.documentElement.classList.contains('reduced-motion')
    || mount.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setCategory(nextCategory) {
    category = Math.max(0, Math.min(categoryNames.length - 1, Number(nextCategory) || 0));
    let stackSlot = 0;
    cards.forEach((card, index) => {
      const held = index === category;
      card.classList.toggle('is-held', held);
      card.classList.toggle('is-stacked', !held);
      card.dataset.stackSlot = held ? '' : String(stackSlot++);
    });
    mount.dataset.indexCategory = categoryNames[category].toLowerCase();
  }

  function setPropsVisible(visible) {
    const stack = svg.querySelector('.index-character__stack');
    if (stack) stack.style.display = visible ? '' : 'none';
    mount.dataset.indexProps = visible ? 'visible' : 'hidden';
  }

  function setPose(pose = 'read', options = {}) {
    window.clearTimeout(settleTimer);
    const token = ++poseToken;
    const fixedPose = reduced() ? 'read' : pose;
    mount.dataset.indexPose = fixedPose;
    mount.dataset.pose = fixedPose;
    stage.style.setProperty('--index-direction', options.direction < 0 ? '-1' : '1');
    stage.style.setProperty('--index-lean', `${Number(options.lean) || 0}deg`);
    stage.style.setProperty('--index-step', `${Number(options.step) || 0}px`);
    if (Number.isInteger(options.category)) setCategory(options.category);
    if (!reduced() && options.settle) {
      settleTimer = window.setTimeout(() => {
        if (token === poseToken) setPose(options.settle, { direction: options.direction, category });
      }, options.duration || 240);
    }
  }

  function stop() {
    window.clearTimeout(settleTimer);
    poseToken += 1;
    setPose('read', { category });
  }

  mount.ownerDocument.addEventListener('visibilitychange', () => {
    if (mount.ownerDocument.hidden) stop();
  });
  setCategory(0);
  setPose('read');
  const api = { mount, svg, setCategory, setPropsVisible, setPose, stop };
  instances.set(mount, api);
  return api;
}
