// Wild monsters (the Pokémon town): after a win there is a small chance a monster appears.
// Translate three place names (English -> Japanese) to catch it. The places come from
// every town the student has already visited, not just this one.
import { h, btn, modal } from '../ui/dom.js';
import { save } from '../progress/save.js';
import { MAPS } from '../data/maps.js';
import { jaName, PLACE_JA } from '../data/placeNames.js';
import { sfx } from '../audio/sfx.js';

const imgs = import.meta.glob('../assets/gimmick/mon*.png', { eager: true, query: '?url', import: 'default' });
const BG = Object.values(import.meta.glob('../assets/gimmick/battle-bg.jpg', { eager: true, query: '?url', import: 'default' }))[0];
const url = n => imgs[`../assets/gimmick/mon${n}.png`];

export const MONSTERS = [
  { id: 'mofun', n: 1, name: 'モフン' },
  { id: 'umikii', n: 2, name: 'ウミキー' },
  { id: 'bobo', n: 3, name: 'ボボ' },
  { id: 'leafy', n: 4, name: 'リーフィ' },
  { id: 'pinkuru', n: 5, name: 'ピンクル' },
  { id: 'yurari', n: 6, name: 'ユラリ' },
];

export const intro = {
  icon: '👾',
  title: 'やせいの モンスター',
  lines: [
    ['👾', 'ミッションのあとに モンスターが でてくることが あるよ。'],
    ['🔤', 'えいごの ばしょの なまえを にほんごで えらぼう！'],
    ['🎯', '3もん せいかいで つかまえられるよ。ずかんに あつまるよ！'],
  ],
};

export const ENCOUNTER_CHANCE = 0.15;
const NEED = 3;

// Every place the student has already reached, on any town. One entry per Japanese name.
export function encounteredPlaces() {
  const s = save.get(), out = new Map();
  for (const m of MAPS) {
    if (m.isTest) continue;
    for (const id of s.visited[m.id] || []) {
      const p = m.graph.point(id);
      const ja = p && jaName(p.name);
      if (ja && !out.has(ja)) out.set(ja, { en: p.name, ja, map: m, audio: p.audio });
    }
  }
  return [...out.values()];
}

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Returns true if a battle was shown.
export async function maybeEncounter({ force = false } = {}) {
  const pool = encounteredPlaces();
  if (pool.length < NEED) return false;
  if (!force && Math.random() > (window.__encounterChance ?? ENCOUNTER_CHANCE)) return false; // override is for testing
  await battle(pool);
  return true;
}

export function battle(pool) {
  return new Promise(res => {
    const mon = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    const known = save.get().dex[mon.id] > 0;
    const questions = shuffle(pool).slice(0, NEED);
    const allJa = [...new Set(Object.values(PLACE_JA))];
    let q = 0, done = false;

    const msg = h('div.b-msg');
    const balls = h('div.b-balls', {}, ...questions.map(() => h('span.ball', {})));
    const monImg = h('img.b-mon', { src: url(mon.n), alt: '' });
    const english = h('div.b-english');
    const choices = h('div.b-choices');
    const close = (caught) => { if (done) return; done = true; m.close(); res(caught); };
    const runBtn = btn('small b-run', 'にげる', () => { sfx.play('press'); close(false); });
    const box = h('div.battle', { style: { backgroundImage: `url(${BG})` } },
      h('div.b-platform'),
      monImg,
      h('div.b-top', {}, h('div.b-name', {}, mon.name, known ? h('small', {}, ' ✔ つかまえたことがある') : null), balls),
      h('div.b-panel', {}, msg, english, choices, runBtn),
    );
    const m = modal(box, { cls: 'battle-modal' });
    sfx.play('bump');
    monImg.animate([{ transform: 'translateX(300px) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: 'ease-out' });
    msg.textContent = `やせいの ${mon.name} が あらわれた！`;
    setTimeout(ask, 1100);

    function ask() {
      if (done) return;
      const cur = questions[q];
      msg.textContent = `にほんごで なんて いうかな？ (${q + 1}/${NEED})`;
      english.textContent = cur.en.replace(/ 7\/11| lawson/, '');
      const url2 = cur.map.audioUrl(cur.audio);
      const wrong = shuffle(allJa.filter(x => x !== cur.ja)).slice(0, 2);
      choices.replaceChildren(...shuffle([cur.ja, ...wrong]).map(opt => {
        const b = btn('primary choice', opt, async () => {
          if (opt === cur.ja) {
            sfx.play('star' + Math.min(3, q + 1));
            b.classList.add('right');
            balls.children[q].classList.add('on');
            choices.querySelectorAll('button').forEach(x => (x.disabled = true));
            q++;
            if (q >= NEED) return caught();
            msg.textContent = 'いいね！ つぎも がんばろう！';
            setTimeout(ask, 900);
          } else {
            sfx.play('error');
            b.classList.add('wrong'); b.disabled = true;
            monImg.animate([{ transform: 'translateX(-14px)' }, { transform: 'translateX(14px)' }, { transform: 'none' }], { duration: 260 });
            msg.textContent = 'おしい！ もういちど えらんでね。';
          }
        });
        return b;
      }));
      if (url2) sfx.voice(url2);
    }

    function caught() {
      const dex = save.get().dex;
      const first = !dex[mon.id];
      dex[mon.id] = (dex[mon.id] || 0) + 1;
      save.addCoins(10);
      save.write();
      sfx.play('win');
      choices.replaceChildren(); english.textContent = ''; runBtn.remove();
      msg.textContent = `${mon.name} を つかまえた！ ${first ? '(あたらしい！)' : ''} コイン +10`;
      monImg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 600 });
      box.querySelector('.b-panel').append(btn('primary', 'やったー！', () => close(true)));
    }
  });
}

export function showDex() {
  const dex = save.get().dex;
  const got = MONSTERS.filter(x => dex[x.id]).length;
  const cells = MONSTERS.map(x => h('div.dex-cell' + (dex[x.id] ? '.on' : ''), {},
    h('img', { src: url(x.n), alt: '' }), h('div.dex-name', {}, dex[x.id] ? x.name : '???'), dex[x.id] ? h('div.dex-n', {}, `×${dex[x.id]}`) : null));
  const m = modal(h('div.stamp-card', {}, h('h2', {}, `モンスターずかん  ${got} / ${MONSTERS.length}`), h('div.dex-grid', {}, ...cells), btn('primary', 'とじる', () => m.close())), { cls: 'gimmick-intro' });
}
