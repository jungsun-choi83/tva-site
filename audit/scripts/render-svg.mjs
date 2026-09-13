// SVG 시안을 PNG 로 뽑는다 (브라우저로 그려서 실제 보이는 대로)
//   node audit/scripts/render-svg.mjs <svg파일> <png파일> [가로] [배경색]
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const [svg, out, W = '400', BG = '#f6f2e8'] = process.argv.slice(2);
const src = fs.readFileSync(svg, 'utf8');
const b = await chromium.launch({ args: ['--proxy-server=http://127.0.0.1:42285','--proxy-bypass-list=127.0.0.1;localhost'] });
const p = await (await b.newContext({ deviceScaleFactor: 2 })).newPage();
await p.setContent(`<body style="margin:0;background:${BG}"><div id="w" style="width:${W}px">${src}</div></body>`);
await p.locator('#w').screenshot({ path: out });
await b.close();
console.log('→', out);
