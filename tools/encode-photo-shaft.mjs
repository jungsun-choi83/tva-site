import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

const cursorAssets = path.join(
  process.env.USERPROFILE,
  '.cursor/projects/c-Users-Desktop-tva-site-2026-09-12-tva-site-2026-09-12/assets',
);
const outDir = path.join(
  process.env.USERPROFILE,
  'Desktop/tva-site-2026-09-12/tva-site-2026-09-12/sofa-journey/assets/bg',
);
const still = path.join(outDir, 'photo-shaft.jpg');
const mp4 = path.join(outDir, 'photo-shaft-fall.mp4');
const webm = path.join(outDir, 'photo-shaft-fall.webm');

const needle = '4131ae389b624bddbd1f38f935813b36';
const src = fs.readdirSync(cursorAssets)
  .filter(name => name.includes(needle) && name.endsWith('.jpg'))
  .map(name => path.join(cursorAssets, name))[0];
if (!src) throw new Error(`missing vortex still in ${cursorAssets}`);
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(src, still);
console.log('still', still, fs.statSync(still).size);

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: 'inherit', windowsHide: true });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

// 원본을 1920에 맞춰 한 번만 키운다. 회전은 CSS가 하므로 여기서 돌리지 않는다.
const vf = [
  'scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos',
  'crop=1920:1080',
  "zoompan=z='1+0.10*pow(on/239,1.35)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30",
  'format=yuv420p',
].join(',');

console.log('encoding mp4');
await run([
  '-y', '-loop', '1', '-framerate', '30', '-i', still,
  '-vf', vf, '-t', '8',
  '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
  '-g', '8', '-keyint_min', '8', '-sc_threshold', '0',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  mp4,
]);

console.log('encoding webm');
await run([
  '-y', '-i', mp4,
  '-an', '-c:v', 'libvpx-vp9', '-b:v', '12000k', '-crf', '18',
  '-deadline', 'good', '-cpu-used', '2',
  '-g', '8', '-auto-alt-ref', '0',
  webm,
]);

console.log('photo shaft video ready', {
  still: fs.statSync(still).size,
  mp4: fs.statSync(mp4).size,
  webm: fs.statSync(webm).size,
});
