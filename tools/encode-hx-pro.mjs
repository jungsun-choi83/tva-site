import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

const cursor = 'C:/Users/성환/.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets';
const outDir = 'C:/Users/성환/Desktop/tva-site-2026-09-12/tva-site-2026-09-12/sofa-journey/assets/bg';
const tmp = path.join(outDir, '_hx-pro-tmp');
fs.mkdirSync(tmp, { recursive: true });

const pairs = [
  ['hx-anadol-01.png', 'hx-03-wire.png'],
  ['hx-anadol-02.png', 'hx-10-circuit.png'],
  ['hx-anadol-03.png', 'hx-06-constellation.png'],
  ['hx-anadol-04.png', 'hx-05-prism.png'],
  ['hx-anadol-06.png', 'hx-07-mercury.png'],
  ['hx-anadol-07.png', 'hx-04-glass.png'],
];

const clipLen = 3.8;
const fade = 0.65;

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: 'inherit', windowsHide: true });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

const clips = [];
for (let i = 0; i < pairs.length; i++) {
  const [baseName, wireName] = pairs[i];
  const base = path.join(cursor, baseName);
  const wire = path.join(cursor, wireName);
  if (!fs.existsSync(base)) throw new Error(`missing ${base}`);
  const clip = path.join(tmp, `c${i}.mp4`);
  clips.push(clip);
  const drift = i % 2 === 0 ? '0.0014' : '0.0011';
  const pan = i % 2 === 0 ? '0.0018' : '-0.0014';
  const filter = wire && fs.existsSync(wire)
    ? `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+${drift},1.32)':d=92:x='iw/2-(iw/zoom/2)+${pan}*on':y='ih/2-(ih/zoom/2)':s=1920x1080,eq=contrast=1.14:saturation=1.18:brightness=0.03,unsharp=5:5:0.7:5:5:0.35[bg];[1:v]scale=1920:1080,format=rgba,colorchannelmixer=aa=0.28[ov];[bg][ov]overlay=0:0`
    : `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+${drift},1.32)':d=92:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080,eq=contrast=1.14:saturation=1.18:brightness=0.03,unsharp=5:5:0.7:5:5:0.35`;
  const inputs = wire && fs.existsSync(wire) ? ['-loop', '1', '-framerate', '24', '-t', String(clipLen), '-i', base, '-loop', '1', '-framerate', '24', '-t', String(clipLen), '-i', wire] : ['-loop', '1', '-framerate', '24', '-t', String(clipLen), '-i', base];
  console.log('clip', i, baseName);
  await run([
    '-y', ...inputs,
    '-filter_complex', filter,
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    clip,
  ]);
}

const inputs = clips.flatMap(file => ['-i', file]);
let filter = '';
let last = '0:v';
for (let i = 1; i < clips.length; i++) {
  const label = i === clips.length - 1 ? 'v' : `x${i}`;
  const offset = (clipLen - fade) * i;
  filter += `[${last}][${i}:v]xfade=transition=fadeblack:duration=${fade}:offset=${offset.toFixed(2)}[${label}];`;
  last = label;
}
filter = filter.replace(/;$/, '');

const mp4 = path.join(outDir, 'hx-vortex-loop.mp4');
await run(['-y', ...inputs, '-filter_complex', filter, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);

const webm = path.join(outDir, 'hx-vortex-loop.webm');
await run(['-y', '-i', mp4, '-an', '-c:v', 'libvpx-vp9', '-b:v', '2800k', '-crf', '30', '-deadline', 'good', '-cpu-used', '4', webm]);

for (const file of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, file));
fs.rmdirSync(tmp);
console.log('hx pro loop ready', fs.statSync(mp4).size, fs.statSync(webm).size);
