// ④ '납작한 그림체' 후보를 만들어 본다 — 새로 그리는 게 아니라 지금 그림을 가공하는 것이다.
//   node audit/scripts/flatten-goya.mjs <파일> <쓸폴더> [가로크기]
//
// 지금 그림이 AI 처럼 보이는 이유 중 하나는 '한 그림 안에 그리는 방식이 둘' 이라는 점이다 —
// 얼굴 털은 사진처럼 한 올씩인데 옷은 납작한 면이다. 털 쪽을 옷 쪽에 맞춰 내리면 하나가 된다.
//
// 순서: ① 알파를 지키며 축소 ② 중앙값 거르기로 털 올을 뭉갠다(경계는 살아남는다)
//       ③ 색을 몇 단계로 줄인다 ④ 필요하면 브랜드 색으로 갈아끼운다 ⑤ 테두리선을 한 겹 두른다
import { PNG } from 'pngjs'; import fs from 'node:fs'; import path from 'node:path';

const [src, outDir, W0] = process.argv.slice(2);
const W = +(W0 || 600);
fs.mkdirSync(outDir, { recursive: true });
const 원 = PNG.sync.read(fs.readFileSync(src));

// ── ① 알파를 곱해서 축소 (테두리에 배경색이 배어 나오지 않게)
function 축소(p, w2) {
  const s = p.width / w2, h2 = Math.round(p.height / s);
  const o = new PNG({ width: w2, height: h2 });
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let R=0,G=0,B=0,A=0,n=0;
    for (let sy = Math.floor(y*s); sy < Math.min(p.height, Math.ceil((y+1)*s)); sy++)
      for (let sx = Math.floor(x*s); sx < Math.min(p.width, Math.ceil((x+1)*s)); sx++) {
        const q=(sy*p.width+sx)*4, a=p.data[q+3]/255;
        R+=p.data[q]*a; G+=p.data[q+1]*a; B+=p.data[q+2]*a; A+=a; n++;
      }
    const q=(y*w2+x)*4;
    o.data[q]   = A>0 ? Math.round(R/A) : 0;
    o.data[q+1] = A>0 ? Math.round(G/A) : 0;
    o.data[q+2] = A>0 ? Math.round(B/A) : 0;
    o.data[q+3] = Math.round(A/n*255);
  }
  return o;
}

// ── ② 중앙값 거르기 — 흐리게 하는 게 아니라 '가장 흔한 값' 으로 바꾼다. 털 올만 사라지고 윤곽은 남는다
function 중앙값(p, r) {
  const o = new PNG({ width: p.width, height: p.height });
  o.data.set(p.data);
  const 값 = new Array((2*r+1)*(2*r+1));
  for (let c = 0; c < 3; c++)
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
      const i=(y*p.width+x)*4; if (p.data[i+3] < 8) continue;
      let n=0;
      for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
        const yy=y+dy, xx=x+dx; if (yy<0||xx<0||yy>=p.height||xx>=p.width) continue;
        const q=(yy*p.width+xx)*4; if (p.data[q+3] < 8) continue;
        값[n++] = p.data[q+c];
      }
      if (!n) continue;
      const 조각 = 값.slice(0, n).sort((a,b)=>a-b);
      o.data[i+c] = 조각[n>>1];
    }
  return o;
}

// ── ③ 색 단계 줄이기 (밝기만 계단으로 — 색조는 그대로 둬서 캐릭터 색이 유지된다)
function 계단(p, 단) {
  const o = new PNG({ width: p.width, height: p.height }); o.data.set(p.data);
  for (let i = 0; i < p.width*p.height; i++) {
    const q=i*4; if (p.data[q+3] < 8) continue;
    const r=p.data[q], g=p.data[q+1], b=p.data[q+2];
    const L = .2126*r + .7152*g + .0722*b;
    const L2 = Math.round(L/255*(단-1))/(단-1)*255;
    const k = L > 1 ? L2/L : 1;
    o.data[q]=Math.min(255,Math.round(r*k)); o.data[q+1]=Math.min(255,Math.round(g*k)); o.data[q+2]=Math.min(255,Math.round(b*k));
  }
  return o;
}

// ── ④ 브랜드 색으로 갈아끼우기 (사이트 토큰에서 뽑은 색)
const 팔레트 = [
  [23,25,35],    // --ink        검은 털
  [74,63,46],    // 그늘진 갈색
  [143,112,52],  // --deep-blue  진한 금
  [200,161,94],  // --cobalt     금 (황갈 털)
  [224,192,138], // 밝은 금
  [197,179,151], // --kraft      옷
  [246,242,232], // --cream      밝은 부분
];
function 팔레트고정(p) {
  const o = new PNG({ width: p.width, height: p.height }); o.data.set(p.data);
  for (let i = 0; i < p.width*p.height; i++) {
    const q=i*4; if (p.data[q+3] < 8) continue;
    const r=p.data[q], g=p.data[q+1], b=p.data[q+2];
    let 최선=0, 최소=1e9;
    for (let k=0;k<팔레트.length;k++){
      const [pr,pg,pb]=팔레트[k];
      // 밝기에 무게를 더 줘서 명암 구조가 유지되게
      const d=(pr-r)**2*.5+(pg-g)**2*1.2+(pb-b)**2*.4;
      if (d<최소){최소=d;최선=k;}
    }
    const [pr,pg,pb]=팔레트[최선];
    o.data[q]=pr; o.data[q+1]=pg; o.data[q+2]=pb;
  }
  return o;
}

// ── ⑤ 실루엣 둘레에 굵기가 일정한 테두리선을 한 겹
function 테두리(p, 두께, 색) {
  const o = new PNG({ width: p.width, height: p.height }); o.data.set(p.data);
  const A=(x,y)=> (x<0||y<0||x>=p.width||y>=p.height) ? 0 : p.data[(y*p.width+x)*4+3];
  for (let y=0;y<p.height;y++) for (let x=0;x<p.width;x++) {
    const i=(y*p.width+x)*4; if (p.data[i+3] < 60) continue;
    let 가=false;
    for (let dy=-두께; dy<=두께 && !가; dy++) for (let dx=-두께; dx<=두께; dx++)
      if (dx*dx+dy*dy <= 두께*두께 && A(x+dx,y+dy) < 60) { 가=true; break; }
    if (가) { o.data[i]=색[0]; o.data[i+1]=색[1]; o.data[i+2]=색[2]; o.data[i+3]=255; }
  }
  return o;
}

const 작게 = 축소(원, W);
const 뭉갬 = 중앙값(작게, Math.max(2, Math.round(W/150)));
const 안 = { };
안['A-계단'] = 테두리(계단(뭉갬, 5), 2, [40,34,26]);
안['B-팔레트'] = 테두리(팔레트고정(중앙값(작게, Math.max(3, Math.round(W/110)))), 2, [23,25,35]);
안['C-3단'] = 테두리(팔레트고정(계단(중앙값(작게, Math.max(4, Math.round(W/90))), 3)), 3, [23,25,35]);
안['원본'] = 작게;

for (const [이름, img] of Object.entries(안)) {
  fs.writeFileSync(path.join(outDir, `${이름}.png`), PNG.sync.write(img));
  console.log('만듦', 이름);
}

// ── 추가 후보 ─────────────────────────────────────────────
// 위 세 가지(계단·팔레트·3단)는 렌더링된 그림의 색만 줄이는 방식이라 실패했다.
// 얼굴처럼 정보가 빽빽한 곳은 계단으로 자르면 눈·주둥이 구조가 통째로 사라지고,
// 옷처럼 완만한 곳은 계단 경계가 얼룩으로 남는다. 색을 줄여서는 '납작한 그림'이 되지 않는다.
//
// 기계로 될 만한 건 방향이 다른 둘이다:
//   D 실루엣  — 안쪽 묘사를 '근사' 하지 않고 아예 버린다. 버리는 건 기계가 잘한다.
//   E 듀오톤  — 계단으로 자르지 않고 밝기를 두 색 사이 띠에 얹는다. 구조는 남고 사진 느낌만 빠진다.

function 실루엣(p, 색, 옷색) {
  const o = new PNG({ width: p.width, height: p.height }); o.data.set(p.data);
  for (let i = 0; i < p.width*p.height; i++) {
    const q=i*4, a=p.data[q+3]; if (a < 8) continue;
    const r=p.data[q], g=p.data[q+1], b=p.data[q+2];
    const L = .2126*r + .7152*g + .0722*b;
    const c = L > 150 ? 옷색 : 색;          // 밝은 곳(옷·발끝)만 갈라 둔다
    o.data[q]=c[0]; o.data[q+1]=c[1]; o.data[q+2]=c[2];
    o.data[q+3] = a > 110 ? 255 : 0;        // 가장자리 반투명을 끊어 또렷한 형태로
  }
  return o;
}

function 듀오톤(p, 어두움, 밝음) {
  const o = new PNG({ width: p.width, height: p.height }); o.data.set(p.data);
  for (let i = 0; i < p.width*p.height; i++) {
    const q=i*4; if (p.data[q+3] < 8) continue;
    const L = (.2126*p.data[q] + .7152*p.data[q+1] + .0722*p.data[q+2]) / 255;
    const t = Math.min(1, Math.max(0, (L - .06) / .82));       // 양 끝을 살짝 눌러 대비를 올린다
    for (let c = 0; c < 3; c++) o.data[q+c] = Math.round(어두움[c] + (밝음[c]-어두움[c]) * t);
  }
  return o;
}

if (process.env.EXTRA) {
  const 잔잔 = 중앙값(작게, Math.max(2, Math.round(W/170)));
  const 추가 = {
    'D-실루엣': 실루엣(중앙값(작게, Math.max(3, Math.round(W/120))), [23,25,35], [246,242,232]),
    'E-듀오톤': 테두리(듀오톤(잔잔, [26,22,18], [246,238,220]), 2, [26,22,18]),
    'E2-듀오톤금': 테두리(듀오톤(잔잔, [23,25,35], [224,192,138]), 2, [23,25,35]),
  };
  for (const [이름, img] of Object.entries(추가)) {
    fs.writeFileSync(path.join(outDir, `${이름}.png`), PNG.sync.write(img));
    console.log('만듦', 이름);
  }
}
