import { PNG } from 'pngjs'; import fs from 'node:fs'; import path from 'node:path';
const [dir, out, ...names] = process.argv.slice(2);
const BG = (process.env.BG || '246,242,232').split(',').map(Number);
const imgs = names.map(n => PNG.sync.read(fs.readFileSync(path.join(dir, n + '.png'))));
const w = imgs[0].width, h = imgs[0].height, GAP = 16;
const W = names.length * w + (names.length - 1) * GAP, H = h;
const o = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) { o.data[i*4]=BG[0]; o.data[i*4+1]=BG[1]; o.data[i*4+2]=BG[2]; o.data[i*4+3]=255; }
imgs.forEach((im, ci) => {
  const ox = ci * (w + GAP);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = (y*w+x)*4, a = im.data[q+3]/255, p = (y*W + x + ox)*4;
    o.data[p]  =Math.round(im.data[q]*a  +BG[0]*(1-a));
    o.data[p+1]=Math.round(im.data[q+1]*a+BG[1]*(1-a));
    o.data[p+2]=Math.round(im.data[q+2]*a+BG[2]*(1-a));
    o.data[p+3]=255;
  }
});
fs.writeFileSync(out, PNG.sync.write(o));
console.log('→', out, `${W}×${H}`);
