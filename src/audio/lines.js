// Voice lines for the blocks. They always come from the Hamanomachi pack
// (maps/hamanomachi/audio/), so every town speaks with the same teacher voice.
import { sfx } from './sfx.js';

const files = import.meta.glob('../../maps/hamanomachi/audio/*.mp3', { eager: true, query: '?url', import: 'default' });
const urlOf = n => files[`../../maps/hamanomachi/audio/${n}.mp3`];

export function lineName(b) {
  switch (b?.type) {
    case 'straight': return `gostraight${b.n || 1}block${(b.n || 1) === 1 ? '' : 's'}`;
    case 'littlebit': return 'gostraightlittlebit';
    case 'right': return 'turnright';
    case 'left': return 'turnleft';
    case 'lookLeft': return 'youcanseeitonyourleft';
    case 'lookRight': return 'youcanseeitonyourright';
    case 'arrive': return 'hereitis';
    case 'fail': return 'uhohnotheresorry';
  }
  return null;
}

// Plays a line; resolves when it ends (or after a safety timeout).
export function say(b) {
  const url = urlOf(lineName(typeof b === 'string' ? { type: b } : b));
  if (!url) return Promise.resolve();
  return new Promise(res => {
    const a = sfx.voice(url);
    if (!a) return res();
    const t = setTimeout(res, 5000);
    const done = () => { clearTimeout(t); res(); };
    a.onended = done; a.onerror = done;
  });
}
