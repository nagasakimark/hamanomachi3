import { ITEMS } from './avatar/items.js';
import { PETS, PET_COLORS } from './pets/petsData.js';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles.css';
import { fitStage, getStageW } from './ui/dom.js';
import '@fontsource/m-plus-rounded-1c/500.css';
import '@fontsource/m-plus-rounded-1c/700.css';
import '@fontsource/m-plus-rounded-1c/800.css';
import { sfx } from './audio/sfx.js';
import { save } from './progress/save.js';
import { MONSTERS } from './gimmicks/monsters.js';
import { preloadLayers } from './avatar/compositor.js';
import { loadTestMap } from './data/maps.js';
import { reconcileUnlocks } from './progress/reconcile.js';
import { showBadges } from './ui/hud.js';
import { titleScreen } from './screens/title.js';
import { townsScreen } from './screens/towns.js';
import { missionsScreen } from './screens/missions.js';
import { playScreen } from './screens/play.js';
import { wardrobeScreen } from './screens/wardrobe.js';
import { stickersScreen } from './screens/stickers.js';

import { app, SCREENS } from './app.js';

Object.assign(SCREENS, { title: titleScreen, towns: townsScreen, missions: missionsScreen, play: playScreen, wardrobe: wardrobeScreen, stickers: stickersScreen });
window.app = app;

// Re-layout when the window changes shape (not during a mission).
let resizeTimer = 0, laidOutW = 0;
window.addEventListener('resize', () => {
  fitStage();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (Math.abs(getStageW() - laidOutW) > 40 && app.currentName && app.currentName !== 'play') {
      laidOutW = getStageW();
      app.go(app.currentName, app.currentParams);
    }
  }, 300);
});
fitStage();
laidOutW = getStageW();
sfx.apply(save.get().settings);
window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
// Tester code: type it once = unlock everything + lots of coins; again = full reset.
{
  const CODE = 'ifiwasarichman'; let typed = '';
  window.addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea') || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-CODE.length);
    if (typed !== CODE) return;
    typed = '';
    const d = save.get();
    if (d.cheat) { save.reset(); sfx.play('error'); } else {
      d.cheat = true; d.coins = Math.max(d.coins, 999999); d.madeCharacter = true;
      for (const it of ITEMS) if (it.price && !d.owned.includes(it.id)) d.owned.push(it.id);
      for (const p of PETS) for (const c of PET_COLORS) { const id = `pc-${p.id}-${c.id}`; if (!d.owned.includes(id)) d.owned.push(id); }
      for (let i = 0; i < 12; i++) for (const k of ['hair', 'cloth']) { const id = `col-${k}-${i}`; if (!d.owned.includes(id)) d.owned.push(id); }
      // everything the town gimmicks hand out (rally ribbon, crafted helmets, power-up hats), plus stock to test with
      for (const it of ITEMS) if (it.gate && !d.owned.includes(it.id)) d.owned.push(it.id);
      d.powerups = { mushroom: 20, flower: 20, star: 20 };
      d.powerCollected = { mushroom: 99, flower: 99, star: 99 }; d.foesDefeated = Math.max(d.foesDefeated || 0, 99);
      for (const m of MONSTERS) d.dex[m.id] = Math.max(d.dex[m.id] || 0, 1);   // the whole monster dex
      d.materials = { wood: 99, stone: 99, iron: 99, gold: 99, diamond: 99 };
      for (const it of ITEMS) if (it.badge && !d.badges[it.badge]) d.badges[it.badge] = Date.now();
      save.write(); sfx.play('buy');
    }
    app.go(save.get().cheat ? 'towns' : 'title');
  });
}
document.addEventListener('contextmenu', e => { if (e.target.closest('#stage')) e.preventDefault(); });

// After a new deploy, a browser that still holds the old page asks for files that no longer exist (404).
// Reload once to pick up the new version instead of showing an error.
window.addEventListener('vite:preloadError', e => {
  e.preventDefault();
  try { if (sessionStorage.getItem('reloaded-for-update')) return; sessionStorage.setItem('reloaded-for-update', '1'); } catch { /* ignore */ }
  location.reload();
});
setTimeout(() => { try { sessionStorage.removeItem('reloaded-for-update'); } catch { /* ignore */ } }, 15000);

(async () => {
  await Promise.all([preloadLayers(), document.fonts?.ready]);
  // hand out rewards that earlier progress already earns (the game is updated while students play)
  let caughtUp = { badges: [] };
  try { caughtUp = reconcileUnlocks(); } catch (e) { console.error('reconcile', e); }
  if (caughtUp.badges.length) setTimeout(() => showBadges(caughtUp.badges).catch?.(() => {}), 1200);
  const params = new URLSearchParams(location.search);
  if (params.has('test')) {
    const m = await loadTestMap();
    if (m) {
      // every Test play starts the test town fresh, so intros and first-time rewards can be tried again
      const sv = save.get();
      for (const k of ['visited', 'stars', 'stamps', 'chests']) delete sv[k]?.[m.id];
      for (const k of Object.keys(sv.seen || {})) if (k.startsWith('gimmick:' + m.id)) delete sv.seen[k];
      save.write();
    }
    if (m) return app.go('missions', { mapId: m.id });
  }
  app.go('title');
})();
