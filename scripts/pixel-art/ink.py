# Usage: python3 ink.py scripts/pixel-art/src src/assets/gimmick/ink src/avatar/layers
# Turn the 8 kawaii mascot pictures into rubber-stamp ink masks (alpha only),
# and draw the stamp-rally ribbon as an avatar layer (LPC walk sheet layout).
from PIL import Image, ImageDraw, ImageFilter
import random, sys, colorsys
SRC, OUT, LAYERS = sys.argv[1], sys.argv[2], sys.argv[3]
R = random.Random(3)
for n in range(1, 9):
    im = Image.open(f'{SRC}/stamp{n}.png').convert('RGBA').resize((200, 200))
    canvas = Image.new('RGBA', (240, 240), (0, 0, 0, 0)); canvas.paste(im, (20, 20), im)
    px = canvas.load(); out = Image.new('L', (240, 240), 0); o = out.load()
    for y in range(240):
        for x in range(240):
            r, g, b, a = px[x, y]
            if a < 40: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            v = 0
            if l < 0.45: v = 255                    # outlines and dark details
            elif s > 0.35 and l < 0.8: v = 150       # coloured areas: half-tone ink
            if v and R.random() < 0.10: v = 0       # rubber-stamp grain
            o[x, y] = v
    d = ImageDraw.Draw(out)
    d.ellipse([4, 4, 235, 235], outline=255, width=9)
    d.ellipse([18, 18, 221, 221], outline=255, width=3)
    out = out.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    o = out.load()
    for _ in range(2600):
        x, y = R.randrange(240), R.randrange(240)
        o[x, y] = 0
    m = Image.new('RGBA', (240, 240), (0, 0, 0, 0)); m.putalpha(out)
    m.save(f'{OUT}/ink{n}.png')

# Ribbon bow layer: 9 frames x 4 rows of 64px, placed on the head of each frame.
head = Image.open(f'{LAYERS}/head__heads__human__male_small__walk.png').convert('RGBA')
sheet = Image.new('RGBA', head.size, (0, 0, 0, 0))
def bow(d, x, y, flip=False):
    O, P, H, K = (138, 48, 80, 255), (255, 170, 200, 255), (255, 225, 236, 255), (240, 110, 160, 255)
    def X(v): return x - v if flip else x + v
    wings = [[(0, 3), (-7, -1), (-8, 7), (0, 5)], [(1, 3), (8, -1), (9, 7), (1, 5)]]
    for wpts in wings:
        d.polygon([(X(a), y + b) for a, b in wpts], fill=P, outline=O)
    d.point((X(-5), y + 1), fill=H); d.point((X(6), y + 1), fill=H)
    d.rectangle([min(X(-1), X(2)), y + 2, max(X(-1), X(2)), y + 6], fill=K, outline=O)
    d.line([(X(-1), y + 7), (X(-3), y + 11)], fill=O); d.line([(X(2), y + 7), (X(4), y + 11)], fill=O)
for row in range(4):
    for col in range(head.width // 64):
        cell = head.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64))
        bb = cell.getbbox()
        if not bb: continue
        x0, y0, x1, y1 = bb
        d = ImageDraw.Draw(sheet)
        cx = col * 64; cy = row * 64
        if row == 2: bow(d, cx + x1 - 6, cy + y0 - 3)            # facing us: bow on the right of the head
        elif row == 0: bow(d, cx + x0 + 6, cy + y0 - 3, True)    # back view: same side seen from behind
        elif row == 1: bow(d, cx + x1 - 5, cy + y0 - 3)          # facing left: bow on the back of the head
        else: bow(d, cx + x0 + 5, cy + y0 - 3, True)
sheet.save(f'{LAYERS}/hat__custom__ribbon__walk.png')
print('ok')
