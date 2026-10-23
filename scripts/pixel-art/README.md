# Gimmick art generators

All town-gimmick art is original and made by these scripts (Python 3 + Pillow), so it can be tweaked and re-made:

- `mon.py <out>` — the 8 pixel-art monsters (`src/assets/gimmick/px/mon*.png`).
- `px2.py <out>` — battle background, capture capsule, block-world blocks and ingots, ? blocks, bricks, coins.
- `ink.py src <out> <layers>` — turns the kawaii mascots in `src/` into rubber-stamp ink masks, and draws the stamp-rally ribbon avatar layer.

```
python3 scripts/pixel-art/mon.py src/assets/gimmick/px
python3 scripts/pixel-art/px2.py src/assets/gimmick/px
python3 scripts/pixel-art/ink.py scripts/pixel-art/src src/assets/gimmick/ink src/avatar/layers
```
The treasure chest, coin and stamp stand are hand-written SVGs in `src/assets/gimmick/svg/`.
