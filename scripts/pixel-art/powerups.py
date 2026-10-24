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
# Each hat is drawn per direction (rows: 0 back, 1 facing left, 2 front, 3 facing right = mirrored left)
# and placed on the head of every walk frame, so it bobs and turns with the character.
head = Image.open(f'{LAYERS}/head__heads__human__male_small__walk.png').convert('RGBA')
HP = {'.': None, 'K': (34, 20, 24, 255), 'R': (226, 44, 40, 255), 'r': (160, 24, 30, 255), 'h': (255, 120, 110, 255),
      'W': (255, 255, 255, 255), 'w': (214, 214, 226, 255), 'O': (255, 120, 20, 255), 'o': (214, 70, 10, 255),
      'Y': (255, 214, 40, 255), 'y': (214, 160, 10, 255), 'G': (56, 176, 64, 255), 'g': (30, 120, 44, 255)}

def grid(rows):
    w = max(len(r) for r in rows)
    im = Image.new('RGBA', (w, len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if HP.get(ch): im.putpixel((x, y), HP[ch])
    return im

MUSH_FRONT = grid([
    '.........KKKKKK.........',
    '......KKKhhRRRRKKK......',
    '....KKRhhWWWRRRRRRKK....',
    '...KRRhWWWWWRRRRWWRRK...',
    '..KRRhRWWWWWRRRWWWWRRK..',
    '..KRhRRRWWWRRRRWWWWRRK..',
    '.KRRhRRRRRRRRRRRRWWRRrK.',
    '.KRWWRRRRRRRRRRRRRRRRrK.',
    'KRRWWWRRRRRRWWWRRRRRRrrK',
    'KRRWWRRRRRRWWWWWRRRRrrrK',
    'KrRRRRRRRRRWWWWWRRRrrrrK',
    'KrrRRRRRRRRRWWWRRRrrrrrK',
    '.KrrrrrrrrrrrrrrrrrrrrK.',
    '..KKKKKKKKKKKKKKKKKKKK..',
])
MUSH_SIDE = grid([   # facing left
    '........KKKKKK..........',
    '.....KKKRRhhRRKKK.......',
    '....KRRRRRRhhWWWRKK.....',
    '...KRRWWRRRRWWWWWRRK....',
    '..KRRWWWWRRRRWWWRRRRK...',
    '..KRRWWWWRRRRRRRRRRRK...',
    '.KRRRRWWRRRRRRRRWWWRrK..',
    '.KRRRRRRRRRRRRRRWWWWRrK.',
    'KRRRRRRRRWWWRRRRRWWRRrK.',
    'KRRRRRRRWWWWWRRRRRRRrrrK',
    'KrRRRRRRWWWWWRRRRRRrrrrK',
    'KrrRRRRRRWWWRRRRRRrrrrrK',
    '.KrrrrrrrrrrrrrrrrrrrrK.',
    '..KKKKKKKKKKKKKKKKKKKK..',
])
FLOWER_FRONT = grid([
    '.....KKKKKK.....',
    '...KKOOOOOOKK...',
    '..KOOYYYYYYOOK..',
    '.KOOYYWWWWYYOOK.',
    '.KOYYWKWWKWYYOK.',
    'KOOYWWKWWKWWYOOK',
    'KOOYWWWWWWWWYOOK',
    '.KOYYWWWWWWYYOK.',
    '.KOOYYYYYYYYOOK.',
    '..KoOOOOOOOOoK..',
    '...KKooooooKK...',
    '.....KKGGKK.....',
    '.KKK..KGgK..KKK.',
    'KGGGKKKGgKKKGGGK',
    '.KgGGGGGgGGGGgK.',
    '..KKKKKKKKKKKK..',
])
FLOWER_BACK = grid([
    '.....KKKKKK.....',
    '...KKooooooKK...',
    '..KooOOOOOOooK..',
    '.KooOOGGGGOOooK.',
    '.KoOOGgGGgGOOoK.',
    'KooOGGgGGgGGOooK',
    'KooOGGGggGGGOooK',
    '.KoOOGGGGGGOOoK.',
    '.KooOOOOOOOOooK.',
    '..KooooooooooK..',
    '...KKooooooKK...',
    '.....KKGGKK.....',
    '.KKK..KGgK..KKK.',
    'KGGGKKKGgKKKGGGK',
    '.KgGGGGGgGGGGgK.',
    '..KKKKKKKKKKKK..',
])
FLOWER_SIDE = grid([   # facing left: the flower is seen edge-on
    '....KKKK......',
    '...KOOOoK.....',
    '..KOYYOoK.....',
    '..KOYWYOoK....',
    '.KOYWWYOoK....',
    '.KOYWWYOoK....',
    '.KOYWWYOoK....',
    '.KOYWWYOoK....',
    '..KOYYOoK.....',
    '..KOOOooK.....',
    '...KKooK......',
    '....KGGK......',
    'KKK.KGgKKKKK..',
    'GGGKKGgKGGGGK.',
    'KgGGGGgGGGgGK.',
    '.KKKKKKKKKKK..',
])
STAR_ROWS = [
    '.......K.......',
    '......KYK......',
    '......KYK......',
    '.....KYYYK.....',
    'KKKKKYYYYYKKKKK',
    '.KYYYYYYYYYYYK.',
    '..KYYYKYKYYYK..',
    '...KYYKYKYYK...',
    '...KYYYYYYYK...',
    '..KYYYYYYYYYK..',
    '..KYYYKKKYYYK..',
    '.KYYYK...KYYYK.',
    '.KYYK.....KYYK.',
    '.KKK.......KKK.',
]
STAR_FRONT = grid(STAR_ROWS)
STAR_SIDE = grid([    # facing left, seen from the side
    '...K...',
    '..KYK..',
    '..KYK..',
    '.KYYK..',
    'KYYYYK.',
    '.KYYYYK',
    '..KYYYK',
    '..KYYK.',
    '.KYYYK.',
    '.KYYYK.',
    'KYYKYK.',
    'KYK.KK.',
    'KK.....',
])
STAR_BACK = grid([r.replace('Y', 'y') for r in STAR_ROWS[:7]])
BAND = {'front': grid(['KKKKKKKKKKKKKKKKKKKKKK', 'KYYyYYYYyYYYYyYYYYyYYK', 'KKKKKKKKKKKKKKKKKKKKKK']),
        'side': grid(['KKKKKKKKKKKKKKKKKKKK', 'KYYyYYYYyYYYYyYYYYyK', 'KKKKKKKKKKKKKKKKKKKK'])}

def place(tile, im, x, y):
    tile.alpha_composite(im, (x, y))

def mirror(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)

def draw_hat(name, tile, cx, top, row):
    side = row in (1, 3)
    def put(im, dx, dy, flip_with_row=True):
        if row == 3 and flip_with_row: im = mirror(im); dx = -dx - im.width
        place(tile, im, cx + dx, top + dy)
    if name == 'pw-mushroom':
        im = MUSH_SIDE if side else MUSH_FRONT if row == 2 else mirror(MUSH_FRONT)
        put(im, -12, -8)                                   # bottom rim sits low on the forehead, over the hair
    elif name == 'pw-flower':
        if side: put(FLOWER_SIDE, -9, -11)
        else: put(FLOWER_FRONT if row == 2 else FLOWER_BACK, -8, -11)
    elif name == 'pw-star':
        if row == 0:                                       # from behind: the band, and the tips of the star poking up
            put(BAND['front'], -11, 3); put(STAR_BACK, -7, -9)
        elif side:
            put(BAND['side'], -10, 3); put(STAR_SIDE, -13, -9)
        else:
            put(BAND['front'], -11, 3); put(STAR_FRONT, -7, -9)

def crown_layer():
    # the LPC crown fits every frame already: make it brighter gold with sapphire tips and a red velvet cap
    src = Image.open(f'{LAYERS}/hat__formal__crown__adult__walk.png').convert('RGBA')
    gold = {(55, 44, 6): (120, 78, 8), (103, 83, 12): (190, 132, 12), (182, 147, 21): (255, 204, 40)}
    out = src.copy()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = src.getpixel((x, y))
            if not a: continue
            k = (r, g, b)
            if k in gold: out.putpixel((x, y), gold[k] + (a,))
            elif k in ((232, 195, 63), (237, 208, 102)):
                light = k == (237, 208, 102)
                tip = (y % 64) <= 8
                c = ((200, 235, 255) if light else (60, 130, 235)) if tip else ((226, 56, 64) if light else (150, 22, 44))  # sapphire tips, red velvet
                out.putpixel((x, y), c + (a,))
    out.save(f'{LAYERS}/hat__custom__pw-crown__walk.png')

for name in ('pw-mushroom', 'pw-flower', 'pw-star'):
    sheet = Image.new('RGBA', head.size, (0, 0, 0, 0))
    for row in range(4):
        for col in range(head.width // 64):
            bb = head.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64)).getbbox()
            if not bb: continue
            tile = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
            draw_hat(name, tile, 32, bb[1], row)
            sheet.alpha_composite(tile, (col * 64, row * 64))
    sheet.save(f'{LAYERS}/hat__custom__{name}__walk.png')
crown_layer()

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
