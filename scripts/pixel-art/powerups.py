# Power-up art (all original): 16x16 icons for the three power-ups, plus the unlockable hat
# layers (LPC walk-sheet layout, 9 frames x 4 directions of 64px) and the shrunk enemy pictures.
#   python3 scripts/pixel-art/powerups.py <px-out> <layers-out> <foes-out> <foes-src-dir>
import sys, os
from PIL import Image, ImageDraw
PX, LAYERS, FOES, SRC = sys.argv[1:5]

PAL = {
    '.': None, 'K': (74, 26, 36, 255), 'R': (232, 56, 60, 255), 'r': (176, 28, 44, 255), 'W': (255, 255, 255, 255),
    'S': (255, 238, 204, 255), 's': (224, 186, 148, 255), 'E': (40, 24, 32, 255), 'O': (255, 150, 40, 255), 'o': (214, 88, 24, 255),
    'Y': (255, 224, 64, 255), 'y': (230, 160, 20, 255), 'G': (70, 180, 90, 255), 'g': (36, 130, 64, 255), 'P': (255, 120, 150, 255),
    'B': (60, 60, 90, 255),
}
ICONS = {
    'pw-mushroom': [
        '................',
        '.....KKKKKK.....',
        '...KKRRRRRRKK...',
        '..KRRWWRRRRRRK..',
        '.KRRWWWWRRWWRRK.',
        '.KRRWWWWRRWWWRK.',
        '.KRRRWWRRRRWRRK.',
        'KRRRRRRRRRRRRRRK',
        'KrrrrrrrrrrrrrrK',
        '.KKKKKKKKKKKKKK.',
        '..KSSSSSSSSSSK..',
        '..KSSEESSEESSK..',
        '..KSSEESSEESSK..',
        '..KsSSSSSSSSsK..',
        '...KssSSSSssK...',
        '....KKKKKKKK....',
    ],
    'pw-flower': [
        '................',
        '....KKK..KKK....',
        '...KOOOKKOOOK...',
        '..KOOYOOOOYOOK..',
        '..KOYYYOOYYYOK..',
        '...KOYYKKYYOK...',
        '.KKKOOKYYKOOKKK.',
        'KOOOOKYWWYKOOOOK',
        'KOYYOKYWWYKOYYOK',
        '.KOOOKKYYKKOOOK.',
        '...KKOKKKKOKK...',
        '.....KKGGKK.....',
        '..KK.KGggGK.KK..',
        '.KGGKKGggGKKGGK.',
        '..KKGGGggGGGKK..',
        '....KKKKKKKK....',
    ],
    'pw-star': [
        '................',
        '.......KK.......',
        '......KYYK......',
        '......KYYK......',
        '.....KYYYYK.....',
        'KKKKKKYYYYKKKKKK',
        'KYYYYYYYYYYYYYYK',
        '.KYYYYEYYEYYYYK.',
        '..KYYYEYYEYYYK..',
        '...KyYYYYYYyK...',
        '...KYYYyyYYYK...',
        '..KYYYKyyKYYYK..',
        '..KYYKK..KKYYK..',
        '.KYYK......KYYK.',
        '.KKK........KKK.',
        '................',
    ],
}
os.makedirs(PX, exist_ok=True)
for name, rows in ICONS.items():
    assert all(len(r) == 16 for r in rows) and len(rows) == 16, name
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if PAL[ch]: im.putpixel((x, y), PAL[ch])
    im.save(f'{PX}/{name}.png')

# ---- hats ----------------------------------------------------------------
head = Image.open(f'{LAYERS}/head__heads__human__male_small__walk.png').convert('RGBA')

def poly(d, pts, fill, outline=None):
    d.polygon(pts, fill=fill, outline=outline)

def mushroom_hat(d, cx, top, row):
    # a red dome with white spots; the same from every side (it is round)
    K, R, r, W = PAL['K'], PAL['R'], PAL['r'], PAL['W']
    w = 12
    d.ellipse([cx - w, top - 9, cx + w, top + 8], fill=R, outline=K)
    d.rectangle([cx - w - 1, top + 3, cx + w + 1, top + 6], fill=r, outline=K)   # brim
    for sx, sy, sr in ([(-5, -3, 3), (3, -5, 3), (7, 0, 2)] if row in (2, 0) else [(-4, -3, 3), (4, -4, 2), (-8, 1, 2)] if row == 1 else [(4, -3, 3), (-4, -4, 2), (8, 1, 2)]):
        d.ellipse([cx + sx - sr, top + sy - sr, cx + sx + sr, top + sy + sr], fill=W)

def flower_hat(d, cx, top, row):
    K, O, Y, G, g = PAL['K'], PAL['O'], PAL['Y'], PAL['G'], PAL['g']
    fy = top - 4
    # leaves
    d.ellipse([cx - 13, fy + 2, cx - 5, fy + 8], fill=G, outline=K); d.ellipse([cx + 5, fy + 2, cx + 13, fy + 8], fill=G, outline=K)
    # petals
    for dx, dy in [(-7, 0), (7, 0), (0, -7), (-5, -5), (5, -5)] if row != 2 else [(-7, 0), (7, 0), (0, -7), (-5, -5), (5, -5)]:
        d.ellipse([cx + dx - 4, fy + dy - 4, cx + dx + 4, fy + dy + 4], fill=O, outline=K)
    d.ellipse([cx - 5, fy - 5, cx + 5, fy + 5], fill=Y, outline=K)
    d.rectangle([cx - 1, fy - 2, cx, fy + 2], fill=PAL['W'])

def star_hat(d, cx, top, row):
    K, Y, y = PAL['K'], PAL['Y'], PAL['y']
    sy = top - 9
    pts = [(cx, sy - 11), (cx + 3, sy - 4), (cx + 11, sy - 3), (cx + 5, sy + 2), (cx + 7, sy + 10), (cx, sy + 6), (cx - 7, sy + 10), (cx - 5, sy + 2), (cx - 11, sy - 3), (cx - 3, sy - 4)]
    poly(d, pts, Y, K)
    d.rectangle([cx - 1, sy - 2, cx, sy + 1], fill=y)
    if row == 2:
        d.point((cx - 3, sy), fill=PAL['E']); d.point((cx + 2, sy), fill=PAL['E'])
    d.rectangle([cx - 2, top + 1, cx + 1, top + 3], fill=y, outline=K)   # little stalk to the head

def crown_hat(d, cx, top, row):
    K, Y, y, R = PAL['K'], PAL['Y'], PAL['y'], PAL['R']
    base = top + 3
    pts = [(cx - 10, base), (cx - 10, base - 11), (cx - 5, base - 6), (cx, base - 13), (cx + 5, base - 6), (cx + 10, base - 11), (cx + 10, base)]
    poly(d, pts, Y, K)
    d.rectangle([cx - 10, base - 3, cx + 10, base], fill=y, outline=K)
    d.rectangle([cx - 1, base - 9, cx + 1, base - 7], fill=R, outline=K)

HATS = {'pw-mushroom': mushroom_hat, 'pw-flower': flower_hat, 'pw-star': star_hat, 'pw-crown': crown_hat}
for name, fn in HATS.items():
    sheet = Image.new('RGBA', head.size, (0, 0, 0, 0))
    for row in range(4):
        for col in range(head.width // 64):
            cell = head.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64))
            bb = cell.getbbox()
            if not bb: continue
            x0, y0, x1, y1 = bb
            tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            fn(ImageDraw.Draw(tile), (x0 + x1) // 2, y0 + 1, row)
            sheet.alpha_composite(tile, (col * 64, row * 64))
    sheet.save(f'{LAYERS}/hat__custom__{name}__walk.png')

# ---- enemies: shrink the supplied pictures to game size ---------------------
FOE_FILES = {'foe-shy': '0e399990', 'foe-bomb': '0031cd6b', 'foe-chomp': '8e2d6de1', 'foe-turtle': '3fd34ddf', 'foe-goomba': 'e40362dd'}
os.makedirs(FOES, exist_ok=True)
for name, stem in FOE_FILES.items():
    f = next((os.path.join(SRC, x) for x in os.listdir(SRC) if x.startswith(stem)), None)
    if not f: print('missing', name); continue
    im = Image.open(f).convert('RGBA'); im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
    k = 140 / max(im.size)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    im.save(f'{FOES}/{name}.png', optimize=True)
print('ok')
