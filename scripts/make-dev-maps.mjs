// Makes throw-away test towns (maps/dev-*) that copy Hamanomachi with a gimmick switched on,
// so the gimmicks can be tried before the real maps exist. They are git-ignored.
// Usage: node scripts/make-dev-maps.mjs stamps|treasure|crafting|blocks   (or `clean`)
import fs from 'node:fs';
const root = new URL('../maps/', import.meta.url).pathname;
const args = process.argv.slice(2);
for (const d of fs.readdirSync(root)) if (d.startsWith('dev-')) fs.rmSync(root + d, { recursive: true });
for (const arg of args.filter(a => a !== 'clean')) {
  const dst = root + 'dev-' + arg;
  fs.cpSync(root + 'hamanomachi', dst, { recursive: true });
  const m = JSON.parse(fs.readFileSync(dst + '/map.json'));
  m.id = 'dev-' + arg; m.name = 'DEV ' + arg; m.order = 5 + args.indexOf(arg); m.unlockStars = 0; m.gimmick = arg;
  m.gimmickData = JSON.parse(fs.readFileSync(new URL('./dev-gimmick-data.json', import.meta.url)).toString())[arg] || {};
  fs.writeFileSync(dst + '/map.json', JSON.stringify(m));
}
