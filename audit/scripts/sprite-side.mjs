// 전/후를 실제 화면 비율로 나란히 (크림 바탕에 합성, 다듬어 축소)
import { PNG } from 'pngjs'; import fs from 'node:fs'; import path from 'node:path';
const [aDir, bDir, out, W, ...files] = process.argv.slice(2);
const BG = (process.env.BG || '246,242,232').split(',').map(Number);
const TW = +W || 300;
const imgs = files.map(f => [PNG.sync.read(fs.readFileSync(path.join(aDir, f))), PNG.sync.read(fs.readFileSync(path.join(bDir, f)))]);
const s = imgs[0][0].width / TW;                       // 축소 배율
const TH = Math.round(imgs[0][0].height / s);
const GAP = 10, COLS = files.length;
const Wd = COLS * (TW * 2 + GAP) + (COLS - 1) * 28, Hd = TH + 26;
const o = new PNG({ width: Wd, height: Hd });
for (let i = 0; i < Wd * Hd; i++) { o.data[i*4]=BG[0]; o.data[i*4+1]=BG[1]; o.data[i*4+2]=BG[2]; o.data[i*4+3]=255; }
imgs.forEach(([A, B], ci) => {
  [[A,0],[B,TW+GAP]].forEach(([src, dx]) => {
    const ox = ci * (TW * 2 + GAP + 28) + dx;
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      // 상자 평균(축소할 때 계단이 생기지 않게)
      let R=0,G=0,Bb=0,Al=0,n=0;
      const x0=Math.floor(x*s), x1=Math.min(src.width, Math.ceil((x+1)*s));
      const y0=Math.floor(y*s), y1=Math.min(src.height, Math.ceil((y+1)*s));
      for (let sy=y0; sy<y1; sy++) for (let sx=x0; sx<x1; sx++) {
        const q=(sy*src.width+sx)*4, a=src.data[q+3]/255;
        R+=src.data[q]*a; G+=src.data[q+1]*a; Bb+=src.data[q+2]*a; Al+=a; n++;
      }
      if(!n) continue;
      const a=Al/n;
      const r = a>0 ? R/Al : 0, g = a>0 ? G/Al : 0, b = a>0 ? Bb/Al : 0;
      const p=((y+18)*Wd + (x+ox))*4;
      o.data[p]  =Math.round(r*a+BG[0]*(1-a));
      o.data[p+1]=Math.round(g*a+BG[1]*(1-a));
      o.data[p+2]=Math.round(b*a+BG[2]*(1-a));
      o.data[p+3]=255;
    }
  });
});
fs.writeFileSync(out, PNG.sync.write(o));
console.log('→', out, `${Wd}×${Hd}`);
