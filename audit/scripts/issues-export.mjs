// ISSUES.md 를 읽어 issues.csv 와 measurements/issues-index.json 을 다시 만든다 (카드가 유일한 원본).
//   node audit/scripts/issues-export.mjs
import fs from 'node:fs';
const src = fs.readFileSync('audit/ISSUES.md', 'utf8');
const blocks = src.split(/\n(?=### #)/).filter(b => b.startsWith('### #'));
const pick = (b, key) => {
  const re = new RegExp(key + ':\\s*([^|\\n]+)');
  const m = re.exec(b); return m ? m[1].trim().replace(/\s+/g, ' ') : '';
};
const rows = blocks.map(b => {
  const head = /^### #([A-Z]\d+)\s+(.*)$/m.exec(b);
  const 카테고리 = head[1][0];
  const 개선 = pick(b, '개선안') || pick(b, '개선안\\(적용하면 한 줄\\)') || pick(b, '결론');
  return {
    id: head[1],
    title: head[2].replace(/[~*]/g, '').trim(),
    cat: 카테고리,
    dev: pick(b, '기기'),
    typ: pick(b, '유형'),
    pri: pick(b, '우선순위'),
    dif: pick(b, '난이도'),
    st: pick(b, '상태'),
    loc: pick(b, '위치'),
    fix: 개선.slice(0, 160),
  };
});
const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
const head = ['ID', '제목', '카테고리', '기기', '유형', '우선순위', '난이도', '상태', '위치', '개선안요약'];
const csv = [head.join(',')].concat(rows.map(r => [r.id, r.title, r.cat, r.dev, r.typ, r.pri, r.dif, r.st, r.loc, r.fix].map(esc).join(','))).join('\n') + '\n';
fs.writeFileSync('audit/issues.csv', csv);
fs.writeFileSync('audit/measurements/issues-index.json', JSON.stringify(rows, null, 1));
const tally = k => rows.reduce((o, r) => (o[r[k] || '(없음)'] = (o[r[k] || '(없음)'] || 0) + 1, o), {});
console.log('총', rows.length, '건');
console.log('우선순위', JSON.stringify(tally('pri')));
console.log('상태', JSON.stringify(tally('st')));
console.log('유형', JSON.stringify(tally('typ')));
console.log('빈 칸 점검 — 기기없음', rows.filter(r => !r.dev).map(r => r.id).join(',') || '0',
  '· 개선안없음', rows.filter(r => !r.fix).map(r => r.id).join(',') || '0');
