import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const outDir = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/sofa-journey/assets/bg';
const tmp = path.join(outDir, '_hx-tmp');
fs.mkdirSync(tmp, { recursive: true });

const sources = [
  'hx-anadol-01.png',
  'hx-anadol-02.png',
  'hx-anadol-03.png',
  'hx-anadol-04.png',
  'hx-anadol-06.png',
  'hx-anadol-07.png',
];

const clipLen = 4.2;
const fade = 0.7;

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: 'inherit', windowsHide: true });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
}

const clips = [];
for (let i = 0; i < sources.length; i++) {
  const src = path.join(cursor, sources[i]);
  if (!fs.existsSync(src)) throw new Error(`missing ${src}`);
  const clip = path.join(tmp, `c${i}.mp4`);
  clips.push(clip);
  const spin = i % 2 === 0 ? '0.18*t' : '-0.14*t';
  console.log('clip', i, sources[i]);
  await run([
    '-y', '-loop', '1', '-framerate', '24', '-t', String(clipLen), '-i', src,
    '-vf', `scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900,rotate=${spin}:ow=1600:oh=900:c=black,eq=saturation=1.08:contrast=1.06,vignette=PI/6`,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    clip,
  ]);
}

const inputs = clips.flatMap(file => ['-i', file]);
let filter = '';
let last = '0:v';
for (let i = 1; i < clips.length; i++) {
  const label = i === clips.length - 1 ? 'v' : `x${i}`;
  const offset = (clipLen - fade) * i;
  filter += `[${last}][${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(2)}[${label}];`;
  last = label;
}
filter = filter.replace(/;$/, '');

const mp4 = path.join(outDir, 'hx-vortex-loop.mp4');
console.log('concat', mp4);
await run([
  '-y', ...inputs,
  '-filter_complex', filter,
  '-map', '[v]',
  '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  mp4,
]);

const webm = path.join(outDir, 'hx-vortex-loop.webm');
console.log('webm', webm);
await run([
  '-y', '-i', mp4,
  '-an', '-c:v', 'libvpx-vp9', '-b:v', '2M', '-crf', '32', '-deadline', 'realtime', '-cpu-used', '6',
  webm,
]);

for (const file of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, file));
fs.rmdirSync(tmp);
console.log('done', fs.statSync(mp4).size, fs.existsSync(webm) ? fs.statSync(webm).size : 0);
