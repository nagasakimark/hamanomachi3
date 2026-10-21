# Map Composer (standalone work copy)

The Composer is a new mode inside the existing map editor. It builds the map
picture itself and can hand the roads and places to the editor's tools.

## Run it

- Double-click `dist-editor/map-editor.html` (one self-contained file, no server).
- Or from this folder: `npm install`, then `npx vite -c vite.editor.config.js` and open `/map-editor.html`.
- Rebuild the single file: `npx vite build -c vite.editor.config.js`.

## What changed in the existing project

New files:

- `src/tools/composer.js`: the Composer (roads, images, walkways, labels, pins, bus stops, PNG export, auto-trace).
- `src/tools/composer.css`: its styles (reuses the editor's `ed-*` classes).
- `vite.editor.config.js`: editor-only single-file build (needs `vite-plugin-singlefile`, added to devDependencies).

Edited file:

- `src/tools/mapEditor.js`: a "Compose map" button, `openCompose()`, a keyboard guard so editor shortcuts stay off while the Composer is open, and a friendlier "Test play" message when no game sits next to the editor.

To put it back into the game: copy those files over, add the devDependency (only needed for the single-file build), and keep `src/audio/sfx.js` where it is.

## How the trace works

"Use picture + trace roads" turns the drawing into `map.json` data:

- Corners, junctions and road ends become `normal` points. Straight-through points are dropped.
- Each pin becomes a `destination` at the door, joined by a short road to a `littlebit` point on the nearest road (or to the corner, if the door is within 14px of it).
- Each bus stop becomes a `start` point on the road, facing the way its arrow points.
- The picture is saved at 1:1 so point coordinates match.

## Compose projects

`Save project` writes a `.compose.json` with the drawing and its building images, so a map can be reopened and changed later. The Composer also autosaves in the browser.

## Building, decoration and water sets

`src/tools/buildingPacks.js` (generated) holds 7 sets of 18 front-facing buildings (Bikini Bottom, Blocky sandbox, Mushroom Kingdom, Monster world, Doraemon-style town, Kawaii pastel town, Matsuri festival), named exactly after the Hamanomachi places. In the Composer's Images tab, pick a set and press "Add this set".

Each of the 7 themes has three sets: Buildings (18), Decorations (12) and Water (6: round pond, kidney pond, straight river, river bend, river end, bridge). Water and ground pieces are flagged "under roads" (toggle in the Selected tab) so roads draw over them; the bridge draws on top. Straight/bend/end pieces share one scale so river widths match; use Rotate and Flip to join them.

## Overlay picture (AI-restyled background)

Map tab → **Choose overlay picture…**. Workflow: build the map, **Save PNG**, have an AI restyle it, load the result as the overlay. It is stretched to the map size and drawn over the background; roads, walkways, pins, bus stops and labels stay on top. By default your own building/decoration pictures are hidden (the overlay already has them); untick that to keep them. Opacity and Remove are in the same panel. The overlay is saved in the project file and used by **Use picture + trace roads**, so road tracing still follows your drawn roads.
