// Shared bits of interface: coin counter, QR code, settings, credits,
// sticker popups.
import { h, btn, modal, toast, countTo, wait } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { save } from '../progress/save.js';
import { BADGES } from '../progress/badges.js';
import qrUrl from '../assets/qrcode.png';
import credits from '../avatar/credits.json';

export function coinPill() {
  const num = h('span.coin-num', {}, String(save.get().coins));
  const el = h('div.pill.coins', {}, h('span.coin-icon'), num);
  el.bump = (from, to) => {
    countTo(num, from, to, 900);
    el.animate([{ transform: 'scale(1.25)' }, { transform: 'none' }], { duration: 300, iterations: 2 });
  };
  el.num = num;
  return el;
}

export function starPill(n, total) {
  return h('div.pill.stars', {}, h('span.star-icon', {}, '★'), `${n}`, total ? h('small', {}, ` / ${total}`) : null);
}

export function iconBtn(icon, title, onClick, cls = '') {
  return btn('icon ' + cls, h('span', { html: icon }), onClick, { title, 'aria-label': title });
}

export const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.9 2.1-2-.3a7 7 0 0 0-.7-1.7l1.2-1.6a1 1 0 0 0-.1-1.3l-1-1a1 1 0 0 0-1.3-.1l-1.6 1.2a7 7 0 0 0-1.7-.7l-.3-2A1 1 0 0 0 12.5 2h-1a1 1 0 0 0-1 .9l-.3 2a7 7 0 0 0-1.7.7L6.9 4.4a1 1 0 0 0-1.3.1l-1 1a1 1 0 0 0-.1 1.3l1.2 1.6a7 7 0 0 0-.7 1.7l-2 .3a1 1 0 0 0-.9 1v1a1 1 0 0 0 .9 1l2 .3c.2.6.4 1.2.7 1.7l-1.2 1.6a1 1 0 0 0 .1 1.3l1 1a1 1 0 0 0 1.3.1l1.6-1.2c.5.3 1.1.5 1.7.7l.3 2a1 1 0 0 0 1 .9h1a1 1 0 0 0 1-.9l.3-2a7 7 0 0 0 1.7-.7l1.6 1.2a1 1 0 0 0 1.3-.1l1-1a1 1 0 0 0 .1-1.3l-1.2-1.6c.3-.5.5-1.1.7-1.7l2-.3a1 1 0 0 0 .9-1v-1a1 1 0 0 0-.9-1Z"/></svg>',
  qr: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h3v3h-3zm5 0h3v3h-3zm-5 5h3v3h-3zm5 0h3v3h-3zm-2.5-2.5h3v3h-3z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  shirt: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3c-.5 1.7-2 3-4 3S8.5 4.7 8 3Z"/></svg>',
  sticker: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z"/></svg>',
  broom: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.4 2.6a1 1 0 0 1 1.4 1.4l-6 6 1.3 1.3a1 1 0 0 1 0 1.4l-.7.7-5.7-5.7.7-.7a1 1 0 0 1 1.4 0l1.3 1.3zM8.3 8.8l6.9 6.9c-1 3-3.4 5.5-7.2 6.3a1 1 0 0 1-.9-.3l-4.8-4.8a1 1 0 0 1-.3-.9c.8-3.8 3.3-6.2 6.3-7.2Z"/></svg>',
  bin: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m9 4 6 2 5-2v16l-5 2-6-2-5 2V6zm1 2.3v11.5l4 1.4V7.7z"/></svg>',
};

export function showQR() {
  sfx.play('whoosh');
  modal(h('div.qr-box', {}, h('img', { src: qrUrl, alt: 'QR code for the game' }), h('p', {}, 'スキャンしてあそぼう！')), { cls: 'qr' });
}

export function showSettings(onChange) {
  const s = save.get().settings;
  const toggle = (key, label, emoji) => {
    const b = h('button.toggle' + (s[key] ? '.on' : ''), {
      onclick: () => {
        s[key] = !s[key];
        b.classList.toggle('on', s[key]);
        save.write(); sfx.apply(s); sfx.play('press');
        onChange?.();
      },
    }, h('span.t-emoji', {}, emoji), label, h('span.knob'));
    return b;
  };
  const content = h('div.settings', {},
    h('h2', {}, 'せってい'),
    h('div.toggles', {}, toggle('sfx', 'こうかおん', '🔔'), toggle('music', 'おんがく', '🎵')),
    h('div.row', {}, btn('secondary', 'クレジット', () => showCredits())),
    h('p.small', {}, 'データはこのChromebookにほぞんされるよ。'),
  );
  modal(content, { cls: 'settings-modal' });
}

export function showCredits() {
  const rows = new Map();
  for (const c of credits) {
    const k = c.authors + '|' + c.licenses;
    if (!rows.has(k)) rows.set(k, { authors: c.authors, licenses: c.licenses, files: [] });
    rows.get(k).files.push(c.file.replace(/\/walk\.png$/, ''));
  }
  modal(h('div.credits', {},
    h('h2', {}, 'クレジット'),
    h('p.credit-main', {}, 'ゲーム: Mark', h('br'), '地図: Heather'),
    h('p', {}, 'Game by Mark. Map by Heather. Characters are made from the Liberated Pixel Cup (LPC) art collection, via the Universal LPC Spritesheet Character Generator. Thank you to all the artists:'),
    h('div.credit-list', {}, ...[...rows.values()].map(r => h('div.credit', {},
      h('b', {}, r.authors), h('div.lic', {}, r.licenses), h('div.files', {}, r.files.join(', '))))),
    h('p.small', {}, 'Built with Phaser. Font: Fredoka.'),
  ), { cls: 'wide' });
}

// Sticker earned popup; resolves when closed.
export function showBadges(list) {
  return list.reduce((p, b) => p.then(() => new Promise(res => {
    sfx.play('badge');
    const m = modal(h('div.badge-pop', {},
      h('div.burst'),
      h('div.sticker.big', { style: { '--c': b.color } }, h('span', {}, b.icon)),
      h('h2', {}, '新しいシール！'),
      h('h3', {}, b.name),
      h('p', {}, b.desc),
      b.reward ? h('p.reward', {}, `「${b.reward}」がつかえるようになったよ！`) : null,
      h('p.reward.coins', {}, '+20 ', h('span.coin-icon.small')),
      btn('primary', 'やったー！', () => m.close()),
    ), { cls: 'badge-modal', onClose: () => setTimeout(res, 200) });
  })), Promise.resolve());
}

export function confirmBox(text, yes = 'はい', no = 'いいえ') {
  return new Promise(res => {
    let answered = false;
    const m = modal(h('div.confirm', {}, h('p', {}, text), h('div.row', {},
      btn('secondary', no, () => { answered = true; m.close(); res(false); }),
      btn('primary', yes, () => { answered = true; m.close(); res(true); }),
    )), { onClose: () => { if (!answered) res(false); } });
  });
}

export { BADGES, wait };
