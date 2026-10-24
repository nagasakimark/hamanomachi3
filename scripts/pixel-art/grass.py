# Tall grass tufts for the monster town (two sway frames). Usage: python3 grass.py <px-out-dir>
import sys
from PIL import Image, ImageDraw
OUT = sys.argv[1]
K, D, G, L, T = (34, 104, 44, 255), (58, 150, 60, 255), (92, 192, 76, 255), (150, 226, 104, 255), (206, 246, 140, 255)
W, H = 26, 20
BLADES = [(2, 9), (5, 3), (8, 7), (11, 1), (14, 5), (17, 2), (20, 6), (23, 4)]   # (x, top y)

def frame(lean):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([0, H - 8, W - 1, H + 3], fill=K)                       # clump base
    for i, (x, top) in enumerate(BLADES):
        l = lean if i % 2 == 0 else lean // 2
        d.polygon([(x - 2, H - 3), (x + 2, H - 3), (x + l, top)], fill=K)
    for i, (x, top) in enumerate(BLADES):
        l = lean if i % 2 == 0 else lean // 2
        d.polygon([(x - 1, H - 3), (x + 1, H - 3), (x + l, top + 2)], fill=G if i % 3 else L)
        d.line([(x + l, top + 2), (x + l, top + 3)], fill=T)
    d.ellipse([1, H - 7, W - 2, H + 2], fill=D)
    for x in range(3, W - 3, 4): d.point((x, H - 4), fill=G)
    return im

frame(0).save(f'{OUT}/grass0.png'); frame(1).save(f'{OUT}/grass1.png')
print('ok')
