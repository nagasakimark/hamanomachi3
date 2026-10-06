# Hamanomachi 2

A directions game for 5th-year elementary students. Listen to someone ask the way, build the directions from blocks, and walk them there.

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # play at http://localhost:5173  (map editor: /map-editor.html)
npm test           # checks the movement rules and every map's missions
npm run build      # makes the finished site in dist/
```

## Publishing on GitHub Pages

The workflow `.github/workflows/pages.yml` builds and publishes the game every time you push to `main`.

One time only: on GitHub, open the repo's **Settings → Pages → Build and deployment**, and set **Source** to **GitHub Actions**. After that the game and the map editor are live at your usual Pages address (the editor at `…/map-editor.html`). No tokens needed.

## Adding a new town

1. Open `map-editor.html`. Press **Help** for the full steps.
2. Open your map picture, draw the roads, and add places, bus stops and voice clips.
3. Fix anything red in the **Checker**, then press **Auto-generate** in **Missions**.
4. Press **Test play** to try it in the real game.
5. Press **Download map pack**, and unzip it into `game/maps/`. You get a folder like `game/maps/newtown/`.
6. Commit and push. The town appears on the town screen automatically.

`unlockStars` (in **Map info**) sets how many stars a student needs before the town opens.

## Map pack format

```
maps/<id>/
  map.json     points, roads, missions, name, unlock stars
  map.png      the picture (any size)
  thumb.png    small picture for the town screen (optional)
  audio/       one clip per place, e.g. postoffice.mp3
```

Point types in `map.json`:

- `normal` is a corner. It counts as one block.
- `littlebit` is where "a little bit" stops. It doesn't count as a block.
- `start` is a bus stop. `facing` is the point the character looks towards.
- `destination` is a place, with its `name` and `audio`.

Setting `"littlebit": true` on any point makes it behave like a little-bit point. The old `start3` point uses this, the same as in the first game.

## Adding wardrobe items

Items are listed in `src/avatar/items.js`. Each one points at LPC sprite paths from the [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator). Only the walk animation is used.

After adding one, run `npm run fetch-lpc`. It downloads the new layers and rebuilds `src/avatar/credits.json`, which the in-game Credits screen shows.

LPC art is CC-BY-SA / GPL / OGA-BY (it varies by item), so the credits must stay in the game.

## Code map

| Folder | What's in it |
| --- | --- |
| `src/engine/` | Movement rules (ported from the first game), the shortest-path solver, and mission generation. No graphics. |
| `src/editor/` | The drag-and-drop block editor and the seven blocks. The block wording lives in `engine.js → blockLabel` and must not change. |
| `src/play/mapView.js` | The Phaser map: walking, turning, camera, confetti, speech bubbles. |
| `src/screens/` | Title, towns, missions, play, wardrobe and shop, sticker book. |
| `src/progress/` | Saving in the browser (localStorage) and stickers. |
| `src/avatar/` | The LPC layer compositor and the item catalogue. |
| `src/audio/sfx.js` | All sound effects, synthesised, so there are no sound files. |
| `src/tools/` | The map editor. |
| `maps/` | Map packs, found automatically. |
| `scripts/` | `convert-old-map.mjs` (the old `map_data.json` to a map pack) and `fetch-lpc.mjs`. |

## Replacing the QR code

Swap `src/assets/qrcode.png` for a new picture with the same name.
