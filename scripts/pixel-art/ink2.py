# Usage: python3 ink2.py src/assets/gimmick/ink
# Draws 7 more kawaii animal stamps (ink9..ink15) in the same rubber-stamp style as ink1..8,
# so every place on the Sanrio-style stamp rally gets its own stamp.
from PIL import Image, ImageDraw, ImageFilter
import random, sys
OUT = sys.argv[1]
S = 3                       # supersample
N = 240 * S
R = random.Random(11)

def canvas():
    im = Image.new('L', (N, N), 0); return im, ImageDraw.Draw(im)
def sc(v): return [x * S for x in v]

def ell(d, box, fill=0, w=5, ink=255):          # outlined ellipse: ink ring, then paper/halftone inside
    x0, y0, x1, y1 = box
    d.ellipse(sc([x0 - w, y0 - w, x1 + w, y1 + w]), fill=ink)
    d.ellipse(sc([x0, y0, x1, y1]), fill=fill)
def poly(d, pts, fill=0, w=5, ink=255):
    d.polygon(sc([c for p in pts for c in p]), fill=ink, outline=ink, width=w * S * 2)
    d.polygon(sc([c for p in pts for c in p]), fill=fill)
def line(d, pts, w=4):
    d.line(sc([c for p in pts for c in p]), fill=255, width=w * S, joint='curve')
def eye(d, cx, cy, r=13):
    d.ellipse(sc([cx - r, cy - r, cx + r, cy + r]), fill=255)
    d.ellipse(sc([cx - r * .1, cy - r * .65, cx + r * .55, cy + r * .0]), fill=0)
    d.ellipse(sc([cx - r * .55, cy + r * .1, cx - r * .15, cy + r * .5]), fill=0)
def cheek(d, cx, cy): d.ellipse(sc([cx - 15, cy - 9, cx + 15, cy + 9]), fill=150)
def smile(d, cx, cy, w=16):
    d.arc(sc([cx - w, cy - w * .6, cx, cy + w * .6]), 20, 160, fill=255, width=4 * S)
    d.arc(sc([cx, cy - w * .6, cx + w, cy + w * .6]), 20, 160, fill=255, width=4 * S)

def panda():
    im, d = canvas()
    ell(d, [40, 38, 90, 88], 255); ell(d, [150, 38, 200, 88], 255)
    ell(d, [38, 60, 202, 200], 0)
    ell(d, [60, 100, 106, 150], 255); ell(d, [134, 100, 180, 150], 255)
    eye(d, 84, 124, 12); eye(d, 156, 124, 12)
    ell(d, [105, 146, 135, 164], 255, w=0)
    smile(d, 120, 172, 14); cheek(d, 62, 164); cheek(d, 178, 164)
    return im
def frog():
    im, d = canvas()
    ell(d, [30, 90, 210, 205], 150)
    ell(d, [50, 40, 108, 100], 0); ell(d, [132, 40, 190, 100], 0)
    eye(d, 79, 72, 15); eye(d, 161, 72, 15)
    d.ellipse(sc([108, 128, 114, 134]), fill=255); d.ellipse(sc([126, 128, 132, 134]), fill=255)
    d.arc(sc([62, 118, 178, 190]), 15, 165, fill=255, width=5 * S)
    cheek(d, 56, 150); cheek(d, 184, 150)
    return im
def pig():
    im, d = canvas()
    poly(d, [(52, 78), (92, 52), (98, 100)], 150); poly(d, [(188, 78), (148, 52), (142, 100)], 150)
    ell(d, [38, 66, 202, 206], 0)
    eye(d, 86, 112, 13); eye(d, 154, 112, 13)
    ell(d, [92, 134, 148, 176], 150)
    d.ellipse(sc([105, 147, 114, 163]), fill=255); d.ellipse(sc([126, 147, 135, 163]), fill=255)
    cheek(d, 62, 150); cheek(d, 178, 150)
    return im
def owl():
    im, d = canvas()
    poly(d, [(60, 70), (74, 36), (100, 62)], 150); poly(d, [(180, 70), (166, 36), (140, 62)], 150)
    ell(d, [40, 52, 200, 208], 150)
    ell(d, [56, 160, 184, 200], 0, w=0)
    ell(d, [54, 84, 114, 144], 0); ell(d, [126, 84, 186, 144], 0)
    eye(d, 84, 114, 17); eye(d, 156, 114, 17)
    poly(d, [(110, 138), (130, 138), (120, 160)], 0)
    for x in (80, 120, 160):
        line(d, [(x - 14, 172), (x, 184), (x + 14, 172)], 3)
    cheek(d, 62, 156); cheek(d, 178, 156)
    return im
def sheep():
    im, d = canvas()
    for cx, cy in [(70, 86), (110, 62), (156, 70), (184, 108), (60, 128), (172, 150), (84, 168), (140, 172)]:
        ell(d, [cx - 32, cy - 32, cx + 32, cy + 32], 0)
    ell(d, [78, 90, 162, 186], 150)
    ell(d, [62, 102, 94, 130], 150, w=4); ell(d, [146, 102, 178, 130], 150, w=4)
    eye(d, 100, 134, 11); eye(d, 140, 134, 11)
    d.ellipse(sc([114, 150, 126, 160]), fill=255)
    smile(d, 120, 166, 12); cheek(d, 86, 154); cheek(d, 154, 154)
    return im
def whale():
    im, d = canvas()
    ell(d, [28, 92, 196, 196], 150)
    poly(d, [(176, 130), (214, 92), (222, 140), (206, 168)], 150)
    ell(d, [50, 140, 170, 196], 0, w=0)
    eye(d, 76, 128, 13); cheek(d, 62, 156)
    d.arc(sc([70, 140, 118, 176]), 20, 160, fill=255, width=4 * S)
    for pts in [[(100, 90), (100, 60)], [(100, 60), (84, 44)], [(100, 60), (116, 44)]]:
        line(d, pts, 5)
    for x, y in [(76, 40), (124, 40), (100, 34)]: d.ellipse(sc([x - 5, y - 5, x + 5, y + 5]), fill=255)
    return im
def hamster():
    im, d = canvas()
    ell(d, [44, 50, 84, 90], 150); ell(d, [156, 50, 196, 90], 150)
    ell(d, [30, 66, 210, 206], 0)
    ell(d, [76, 92, 164, 160], 0, w=0)
    eye(d, 86, 112, 13); eye(d, 154, 112, 13)
    ell(d, [112, 128, 128, 140], 255, w=0)
    d.rectangle(sc([112, 150, 119, 164]), fill=255); d.rectangle(sc([121, 150, 128, 164]), fill=255)
    d.rectangle(sc([114, 152, 117, 162]), fill=0); d.rectangle(sc([123, 152, 126, 162]), fill=0)
    for dy in (-6, 6):
        line(d, [(60, 150 + dy), (24, 142 + dy * 2)], 3); line(d, [(180, 150 + dy), (216, 142 + dy * 2)], 3)
    cheek(d, 58, 166); cheek(d, 182, 166)
    return im

for n, fn in enumerate([panda, frog, pig, owl, sheep, whale, hamster], start=9):
    im = fn()
    d = ImageDraw.Draw(im)
    d.ellipse(sc([4, 4, 235, 235]), outline=255, width=9 * S)
    d.ellipse(sc([18, 18, 221, 221]), outline=255, width=3 * S)
    im = im.resize((240, 240), Image.LANCZOS).point(lambda v: 255 if v > 200 else (150 if v > 90 else 0))
    # rubber-stamp grain
    px = im.load()
    for _ in range(2600): px[R.randrange(240), R.randrange(240)] = 0
    m = Image.new('RGBA', (240, 240), (0, 0, 0, 0)); m.putalpha(im)
    m.save(f'{OUT}/ink{n}.png')
print('ok')
