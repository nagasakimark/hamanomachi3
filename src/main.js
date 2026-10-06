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
import { preloadLayers } from './avatar/compositor.js';
import { loadTestMap } from './data/maps.js';
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
document.addEventListener('contextmenu', e => { if (e.target.closest('#stage')) e.preventDefault(); });

(async () => {
  await Promise.all([preloadLayers(), document.fonts?.ready]);
  const params = new URLSearchParams(location.search);
  if (params.has('test')) {
    const m = await loadTestMap();
    if (m) return app.go('missions', { mapId: m.id });
  }
  app.go('title');
})();
