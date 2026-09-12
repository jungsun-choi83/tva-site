const planes = [
  [[71, 327], [363, 270], [425, 662], [130, 717]],
  [[377, 297], [659, 228], [750, 617], [464, 682]],
  [[670, 253], [947, 203], [1050, 585], [754, 645]],
  [[955, 205], [1247, 171], [1324, 570], [1059, 589]],
];
// `planes` are the printed areas. Each sheet also has a white mount around the
// print, roughly 22px wide in source pixels (sampled across all four sheets:
// print edge, then mount, then the sheet's own dark edge line at ~24px).
// Hovering used to lift the print alone and leave that mount sitting on the
// table, which read as the picture sliding out of its own paper. So the shape
// that moves is the whole sheet: every edge of the print quad is pushed out by
// PAPER_MARGIN and the edges re-intersected, which also tucks the sheet's
// painted edge line under the moving copy instead of leaving it behind.
const PAPER_MARGIN = 24;

function expandQuad(quad, margin) {
  const cx = quad.reduce((sum, p) => sum + p[0], 0) / quad.length;
  const cy = quad.reduce((sum, p) => sum + p[1], 0) / quad.length;
  const edges = quad.map((point, index) => {
    const [x1, y1] = point;
    const [x2, y2] = quad[(index + 1) % quad.length];
    const length = Math.hypot(x2 - x1, y2 - y1);
    let nx = -(y2 - y1) / length;
    let ny = (x2 - x1) / length;
    if (Math.hypot(x1 + nx - cx, y1 + ny - cy) < Math.hypot(x1 - cx, y1 - cy)) { nx = -nx; ny = -ny; }
    return [x1 + nx * margin, y1 + ny * margin, x2 + nx * margin, y2 + ny * margin];
  });
  return quad.map((_, index) => {
    const [x1, y1, x2, y2] = edges[(index - 1 + edges.length) % edges.length];
    const [x3, y3, x4, y4] = edges[index];
    const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    const p = (x1 * y2 - y1 * x2), q = (x3 * y4 - y3 * x4);
    return [(p * (x3 - x4) - (x1 - x2) * q) / d, (p * (y3 - y4) - (y1 - y2) * q) / d];
  });
}

const visiblePlanes = planes.map(quad => expandQuad(quad, PAPER_MARGIN));
const ns = 'http://www.w3.org/2000/svg';
const projections = new WeakMap();

export function populateOriginalSlot(button, work, index) {
  const [a, b, c, d] = planes[index];
  const points = visiblePlanes[index];
  const left = Math.min(...points.map(p => p[0]));
  const top = Math.min(...points.map(p => p[1]));
  const width = Math.max(...points.map(p => p[0])) - left;
  const height = Math.max(...points.map(p => p[1])) - top;
  // Each sheet hangs from a bulldog clip painted at the middle of its top edge,
  // so the hover sway in original-table.css pivots there rather than at the box
  // centre. a and b are that top edge; the origin is its midpoint, expressed as a
  // percentage of this button's own box.
  const clipX = (a[0] + b[0]) / 2;
  const clipY = (a[1] + b[1]) / 2;
  // 무대가 위를 얼마나 자르는지(--scene-crop)와 무대 높이(--scene-h)는 CSS 가 정한다: 데스크탑 0/941, 모바일 70/871 (2026-09-10)
  const sceneStyle = getComputedStyle(button.closest('.original-table') || document.documentElement);
  const crop = Number.parseFloat(sceneStyle.getPropertyValue('--scene-crop')) || 0;
  const sceneH = Number.parseFloat(sceneStyle.getPropertyValue('--scene-h')) || 871;
  Object.assign(button.style, {
    left: `${left / 1671 * 100}%`, top: `${(top - crop) / sceneH * 100}%`,
    width: `${width / 1671 * 100}%`, height: `${height / sceneH * 100}%`,
    clipPath: `polygon(${points.map(p => `${(p[0] - left) / width * 100}% ${(p[1] - top) / height * 100}%`).join(',')})`,
    zIndex: String([1, 2, 4, 3][index]),
    transformOrigin: `${(clipX - left) / width * 100}% ${(clipY - top) / height * 100}%`,
  });
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  if (work.image) {
    const image=document.createElement('img');
    image.dataset.originalImage=work.id;
    image.src=work.image; image.alt=work.alt || work.title;
    Object.assign(image.style,{position:'absolute',left:'0',top:'0',width:'420px',height:'594px',maxWidth:'none',objectFit:'cover',objectPosition:work.position==='xMidYMin'?'center top':work.position==='xMidYMax'?'center bottom':'center',transformOrigin:'0 0'});
    projections.set(button,{image,points:[a,b,c,d],left,top,width});
    button.append(image);
    resizeOriginalSlot(button);
  } else {
    const image = document.createElementNS(ns, 'image');
    image.dataset.originalImage = work.id;
    image.setAttribute('href', document.querySelector('.original-table__image').currentSrc || 'assets/original-table/table-clean-1671.webp?v=r37');
    image.setAttribute('width', '1671'); image.setAttribute('height', '941');
    svg.append(image);
  }
  const focusRing = document.createElementNS(ns, 'polygon');
  focusRing.classList.add('original-table__focus-ring');
  focusRing.setAttribute('points', points.map(point => point.join(',')).join(' '));
  focusRing.setAttribute('fill', 'none');
  focusRing.setAttribute('stroke', 'var(--cobalt)');
  focusRing.setAttribute('stroke-width', '5');
  focusRing.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(focusRing);
  button.append(svg);
}

// The character was painted into the worktable with one hand in front of the
// fourth sheet, so this layer redrew that hand on top of the slots to stop the
// sheet covering it. The artwork no longer has a character (table-clean-*.webp),
// so redrawing that hand-shaped patch would stamp a piece of bare table over the
// sheet. Kept as a no-op rather than deleted: restoring the old art is one line.
export function preserveOriginalForeground() {}

export function preserveOriginalForegroundLegacy(root) {
  const svg=document.createElementNS(ns,'svg');
  svg.classList.add('original-table__foreground');
  svg.setAttribute('viewBox','0 70 1671 871'); svg.setAttribute('aria-hidden','true');
  svg.innerHTML='<defs><clipPath id="original-hand"><path d="M1084 548 C1082 529 1098 514 1116 515 L1115 523 Q1110 534 1124 538 L1145 545 Q1140 552 1144 559 Q1147 570 1165 568 Q1176 563 1193 568 Q1211 575 1224 563 L1234 550 Q1270 554 1305 553 L1307 529 Q1270 521 1244 527 Q1237 514 1220 514 Q1210 500 1195 496 Q1172 489 1153 498 L1147 506 Q1128 497 1117 513 C1092 511 1083 530 1084 548 Q1085 574 1111 582 Q1140 590 1161 574 L1143 563 Q1137 552 1145 546 L1124 538 Q1110 530 1116 518 Q1083 524 1084 548Z"/></clipPath></defs>';
  const image=document.createElementNS(ns,'image');
  image.setAttribute('href',document.querySelector('.original-table__image').currentSrc);
  image.setAttribute('width','1671');image.setAttribute('height','941');
  image.setAttribute('clip-path','url(#original-hand)');
  svg.append(image);root.append(svg);
}

function resizeOriginalSlot(button) {
  const projection=projections.get(button);
  if (!projection) return;
  // Layout width, not the client rect: on phones the whole scene is zoomed
  // with a CSS transform, and the projected image lives in the button's own
  // (unzoomed) coordinate space. Measuring the zoomed rect scaled the matrix a
  // second time and the picture landed small in the sheet's corner.
  const scale=button.offsetWidth/projection.width;
  const [a,b,c,d]=projection.points.map(([x,y])=>[(x-projection.left)*scale,(y-projection.top)*scale]);
  const dx1=b[0]-c[0],dx2=d[0]-c[0],dx3=a[0]-b[0]+c[0]-d[0];
  const dy1=b[1]-c[1],dy2=d[1]-c[1],dy3=a[1]-b[1]+c[1]-d[1];
  const determinant=dx1*dy2-dx2*dy1;
  const g=(dx3*dy2-dx2*dy3)/determinant;
  const h=(dx1*dy3-dx3*dy1)/determinant;
  const matrix=[(b[0]-a[0]+g*b[0])/420,(b[1]-a[1]+g*b[1])/420,0,g/420,(d[0]-a[0]+h*d[0])/594,(d[1]-a[1]+h*d[1])/594,0,h/594,0,0,1,0,a[0],a[1],0,1];
  projection.image.style.transform=`matrix3d(${matrix.join(',')})`;
}

export function observeOriginalSlotSize(root) {
  const observer=new ResizeObserver(()=>root.querySelectorAll('.original-table__work').forEach(resizeOriginalSlot));
  observer.observe(root);
}
