# Original pixel-art monsters (GBA-style): flat shapes -> shading -> coloured outline.
from PIL import Image, ImageDraw
import math, sys
OUT = sys.argv[1]
N = 56

def hexc(s): s=s.lstrip('#'); return tuple(int(s[i:i+2],16) for i in (0,2,4))
def mul(c,k): return tuple(max(0,min(255,int(v*k))) for v in c)
def mix(a,b,t): return tuple(int(a[i]*(1-t)+b[i]*t) for i in range(3))

class D:
    def __init__(s,d): s.d=d
    def __getattr__(s,k):
        f=getattr(s.d,k)
        return lambda *a,**kw: f(*a,**({'fill':255}|kw))
class Spr:
    def __init__(s): s.layers=[]  # (mask image L, color, shade?)
    def layer(s, col, shade=True):
        m=Image.new('L',(N,N),0); s.layers.append((m,hexc(col) if isinstance(col,str) else col,shade)); return D(ImageDraw.Draw(m))
    def render(s, outline_k=0.38):
        im=Image.new('RGBA',(N,N),(0,0,0,0)); px=im.load(); owner=[[None]*N for _ in range(N)]
        for li,(m,c,sh) in enumerate(s.layers):
            mp=m.load()
            for y in range(N):
                for x in range(N):
                    if mp[x,y]>127: owner[y][x]=li
        def inl(li,x,y): return 0<=x<N and 0<=y<N and owner[y][x]==li
        for y in range(N):
            for x in range(N):
                li=owner[y][x]
                if li is None: continue
                m,c,sh=s.layers[li]; col=c
                if sh:
                    if not inl(li,x+2,y+2) or not inl(li,x+1,y+3): col=mul(c,0.78)
                    elif not inl(li,x-1,y-1) and inl(li,x+1,y+1): col=mix(c,(255,255,255),0.45)
                px[x,y]=col+(255,)
        # coloured outline: darker version of neighbour
        out=im.copy(); op=out.load()
        for y in range(N):
            for x in range(N):
                if owner[y][x] is not None:
                    # inner outline between different layers
                    li=owner[y][x]
                    for dx,dy in ((1,0),(0,1)):
                        X,Y=x+dx,y+dy
                        if 0<=X<N and 0<=Y<N and owner[Y][X] is not None and owner[Y][X]!=li and s.layers[li][2]=='edge':
                            op[x,y]=mul(s.layers[li][1],outline_k)+(255,)
                    continue
                nb=[owner[y+dy][x+dx] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if 0<=x+dx<N and 0<=y+dy<N and owner[y+dy][x+dx] is not None]
                if nb: op[x,y]=mul(s.layers[nb[0]][1],outline_k)+(255,)
        return out

def eyes(im, pts, size=3, col=(30,24,40), glint=True):
    d=ImageDraw.Draw(im)
    for (x,y) in pts:
        d.rectangle([x,y,x+size-1,y+size+0],fill=col+(255,))
        if glint: d.point((x,y),fill=(255,255,255,255)); 
    return im
def blush(im, pts, col='#ff8fb0'):
    d=ImageDraw.Draw(im)
    for x,y in pts: d.rectangle([x,y,x+2,y],fill=hexc(col)+(255,))
def save(im,name,scale=1):
    im.save(f'{OUT}/{name}.png')

# 1 Mofun: cloud sheep
s=Spr()
h=s.layer('#ffd968'); h.ellipse([12,12,19,19]); h.ellipse([36,12,43,19])          # curled horns
b=s.layer('#f4f1ff')
for (cx,cy,r) in [(20,28,10),(36,28,10),(28,22,10),(16,36,8),(40,36,8),(28,38,11),(28,30,12)]: b.ellipse([cx-r,cy-r,cx+r,cy+r])
f=s.layer('#e9dcf5'); f.ellipse([19,24,37,40])                                     # face patch
l=s.layer('#8d7aa8'); l.rectangle([20,46,24,51]); l.rectangle([32,46,36,51])         # feet
im=s.render(); eyes(im,[(23,29),(31,29)]); blush(im,[(20,34),(34,34)]); ImageDraw.Draw(im).point((28,35),fill=(120,80,110,255)); save(im,'mon1')

# 2 Umikii: jellyfish
s=Spr()
t=s.layer('#7fc8ff')
for i,x in enumerate([17,24,32,39]):
    for y in range(32,52):
        xx=int(x+2*math.sin((y+i*3)/3)); t.rectangle([xx,y,xx+2,y])
b=s.layer('#a6e3ff'); b.pieslice([10,6,46,46],180,360); b.rectangle([10,25,46,30])
for x in range(10,47,6): b.ellipse([x-1,27,x+5,34])                                # frilly rim
sp=s.layer('#ffe27a'); sp.polygon([(28,10),(30,14),(34,14),(31,17),(32,21),(28,18),(24,21),(25,17),(22,14),(26,14)])
im=s.render(); eyes(im,[(21,21),(33,21)]); blush(im,[(18,26),(35,26)]); d=ImageDraw.Draw(im); d.line([(26,27),(30,27)],fill=(60,70,120,255)); save(im,'mon2')

# 3 Bobo: chochin lantern spirit
s=Spr()
fl=s.layer('#ff9a2e'); fl.polygon([(28,0),(34,8),(33,13),(23,13),(22,8)])
fi=s.layer('#ffe45c',False); fi.polygon([(28,5),(31,10),(30,13),(26,13),(25,10)])
top=s.layer('#3b3140'); top.rectangle([20,12,36,15]); top.rectangle([20,46,36,49])
b=s.layer('#ff7a3d'); b.ellipse([12,13,44,49])
im=s.render(); d=ImageDraw.Draw(im)
for y in (20,26,32,38,43): 
    w=int(15*math.sqrt(max(0,1-((y-31)/18)**2))); d.line([(28-w,y),(28+w,y)],fill=(201,79,40,255))
d.ellipse([21,22,33,32],fill=(255,255,255,255),outline=(60,40,40,255)); d.rectangle([26,25,29,29],fill=(30,24,40,255)); d.point((26,25),fill=(255,255,255,255))
d.polygon([(26,38),(31,38),(30,45),(28,43)],fill=(240,90,120,255)); d.line([(23,37),(34,37)],fill=(90,30,30,255))
save(im,'mon3')

# 4 Leafy: sprout
s=Spr()
lf=s.layer('#4fbf5a')
lf.polygon([(28,16),(14,6),(10,10),(18,16)]); lf.polygon([(28,16),(42,4),(46,9),(37,16)])
st=s.layer('#3d9b48',False); st.rectangle([27,12,29,19])
b=s.layer('#b9e58a'); b.ellipse([12,16,44,48])
ft=s.layer('#7cb35a'); ft.ellipse([15,44,24,51]); ft.ellipse([32,44,41,51])
a=s.layer('#9dd270'); a.ellipse([7,30,15,37]); a.ellipse([41,30,49,37])
im=s.render(); eyes(im,[(21,28),(32,28)],size=3); blush(im,[(18,35),(35,35)]); d=ImageDraw.Draw(im); d.arc([24,33,32,39],20,160,fill=(60,90,40,255)); save(im,'mon4')

# 5 Pinkuru: mochi bunny with tiny wings
s=Spr()
w=s.layer('#ffffff'); w.polygon([(8,26),(2,18),(4,32),(12,34)]); w.polygon([(48,26),(54,18),(52,32),(44,34)])
e=s.layer('#ffb3cf'); e.ellipse([16,2,24,26]); e.ellipse([32,2,40,26])
ei=s.layer('#ff7fac',False); ei.ellipse([18,6,22,20]); ei.ellipse([34,6,38,20])
b=s.layer('#ffc8dc'); b.ellipse([10,20,46,52])
im=s.render(); eyes(im,[(21,32),(33,32)]); blush(im,[(17,39),(36,39)],'#ff6f9c'); d=ImageDraw.Draw(im); d.point((27,38),fill=(130,60,80,255)); d.point((29,38),fill=(130,60,80,255)); d.point((28,39),fill=(130,60,80,255)); save(im,'mon5')

# 6 Yurari: wisp ghost with a tiny crown
s=Spr()
c=s.layer('#ffd23f'); c.polygon([(22,10),(24,4),(27,8),(29,3),(31,8),(34,4),(36,10)])
b=s.layer('#d9ccff'); b.ellipse([14,8,44,40]); b.polygon([(14,26),(44,26),(42,44),(36,40),(30,48),(24,41),(18,46)])
a=s.layer('#c4b2f5'); a.ellipse([8,26,16,32]); a.ellipse([42,24,50,30])
im=s.render(); eyes(im,[(22,21),(33,21)],size=3); blush(im,[(19,28),(35,28)]); d=ImageDraw.Draw(im); d.rectangle([27,27,30,30],fill=(90,50,110,255)); d.rectangle([28,30,29,31],fill=(240,90,120,255)); save(im,'mon6')

# 7 Kachiri: electric hedgehog-ball (new)
s=Spr()
sp=s.layer('#ffd84a')
for i in range(9):
    a=math.pi*(1.05+i*0.11); x=28+19*math.cos(a); y=30+19*math.sin(a); x2=28+12*math.cos(a-0.15); y2=30+12*math.sin(a-0.15); x3=28+12*math.cos(a+0.15); y3=30+12*math.sin(a+0.15)
    sp.polygon([(x,y),(x2,y2),(x3,y3)])
b=s.layer('#fff3b0'); b.ellipse([12,16,44,48])
ft=s.layer('#e0a52a'); ft.ellipse([17,44,25,50]); ft.ellipse([31,44,39,50])
im=s.render(); eyes(im,[(21,28),(32,28)]); blush(im,[(17,35),(35,35)],'#ff9a5a'); d=ImageDraw.Draw(im); d.line([(26,37),(28,39),(30,37)],fill=(110,70,30,255)); save(im,'mon7')

# 8 Pochon: water-drop puppy (new)
s=Spr()
ea=s.layer('#3f86d9'); ea.ellipse([8,18,18,34]); ea.ellipse([38,18,48,34])
b=s.layer('#6fb6ff'); b.polygon([(28,4),(40,22),(18,22)]); b.ellipse([14,14,42,48])
bl=s.layer('#d8f0ff'); bl.ellipse([20,30,36,44])
im=s.render(); eyes(im,[(21,25),(32,25)]); d=ImageDraw.Draw(im); d.rectangle([27,31,29,32],fill=(30,30,60,255)); d.line([(25,35),(28,36),(31,35)],fill=(40,60,110,255)); blush(im,[(18,31),(35,31)]); save(im,'mon8')
print('ok')
