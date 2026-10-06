// Downloads every LPC layer listed in src/avatar/items.js from the Universal
// LPC Spritesheet Character Generator repo and writes the matching credits.
// Usage: npm run fetch-lpc
import fs from 'node:fs';
import path from 'node:path';
import { allLayerPaths } from '../src/avatar/items.js';

const REPO = 'https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master';
const outDir = new URL('../src/avatar/layers/', import.meta.url).pathname;
fs.mkdirSync(outDir, { recursive: true });

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur.trim()); cur = ''; }
    else if (c === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
  return rows;
}

const fileName = p => p.replace(/\//g, '__');
const csv = parseCsv(await (await fetch(`${REPO}/CREDITS.csv`)).text());
const byFile = new Map(csv.slice(1).map(r => [r[0], { notes: r[1], authors: r[2], licenses: r[3], urls: r[4] }]));
const credits = [];
for (const p of allLayerPaths()) {
  const dest = path.join(outDir, fileName(p));
  if (!fs.existsSync(dest)) {
    const res = await fetch(`${REPO}/spritesheets/${p}`);
    if (!res.ok) { console.error('MISSING', p, res.status); continue; }
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log('downloaded', p);
  }
  const c = byFile.get(p);
  credits.push({ file: p, ...(c || { authors: 'see LPC generator', licenses: 'see LPC generator' }) });
}
fs.writeFileSync(new URL('../src/avatar/credits.json', import.meta.url), JSON.stringify(credits, null, 1));
console.log(`credits for ${credits.length} layers written`);
