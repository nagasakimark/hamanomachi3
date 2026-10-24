// The game is updated while students are already playing. When it starts, look at what each
// student has already done (stars, places, stamps, power-ups...) and hand out anything that
// progress now earns, so nobody has to redo work to get a reward added later.
// Towns and mission levels unlock from the star count every time, so they need nothing here.
import { save } from './save.js';
import { checkBadges } from './badges.js';
import { MAPS } from '../data/maps.js';
import { totalStamps, REWARD_ITEM } from '../gimmicks/stamps.js';
import { grantUnlocks } from '../gimmicks/powerups.js';

export function reconcileUnlocks() {
  const s = save.get();
  let changed = false;
  // stamp rally: a finished stamp card gives the rally ribbon
  for (const m of MAPS) {
    if (m.gimmick !== 'stamps' || m.isTest) continue;
    if ((s.stamps[m.id] || []).length >= totalStamps(m) && !s.owned.includes(REWARD_ITEM)) { s.owned.push(REWARD_ITEM); changed = true; }
  }
  // power-up hats (Mushroom Kingdom)
  const hats = grantUnlocks();
  if (changed) save.write();
  // stickers whose rule is already met (e.g. stars collected before the sticker existed)
  const badges = checkBadges();
  return { hats, badges };
}
