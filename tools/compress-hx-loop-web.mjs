import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';

const src = path.join(
  process.env.USERPROFILE,
  'Desktop/tva-site-2026-09-12/tva-site-2026-09-12/sofa-journey/assets/bg/hx-vortex-loop.mp4',
);
const outDir = path.dirname(src);
const mp4 = path.join(outDir, 'hx-vortex-loop-web.mp4');
const webm = path.join(outDir, 'hx-vortex-loop-web.webm');

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: 'inherit', windowsHide: true });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

console.log('compress mp4', src, '->', mp4);
await run([
  '-y', '-i', src,
  '-an',
  '-vf', 'scale=1280:-2',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '30',
  '-maxrate', '1600k', '-bufsize', '3200k',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  mp4,
]);

console.log('compress webm', webm);
await run([
  '-y', '-i', mp4,
  '-an',
  '-c:v', 'libvpx-vp9', '-b:v', '1200k', '-crf', '34',
  '-deadline', 'realtime', '-cpu-used', '6',
  webm,
]);

const a = fs.statSync(mp4).size;
const b = fs.statSync(webm).size;
console.log('web loop ready', { mp4MB: +(a / 1048576).toFixed(1), webmMB: +(b / 1048576).toFixed(1) });
if (a > 95 * 1048576 || b > 95 * 1048576) {
  throw new Error('compressed files still over 95MB');
}
