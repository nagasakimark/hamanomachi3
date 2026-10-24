from PIL import Image, ImageDraw
import random, math, sys
OUT=sys.argv[1]
def hexc(s): s=s.lstrip('#'); return tuple(int(s[i:i+2],16) for i in (0,2,4))
def mul(c,k): return tuple(max(0,min(255,int(v*k))) for v in c)
def grid(rows, pal, w=None):
    w=w or max(len(r) for r in rows); im=Image.new('RGBA',(w,len(rows)),(0,0,0,0)); p=im.load()
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch in pal: p[x,y]=hexc(pal[ch])+(255,)
    return im
R=random.Random(4)

# ---------- battle background 240x160 ----------
bg=Image.new('RGB',(240,160)); d=ImageDraw.Draw(bg)
sky=['#9fd8f5','#acdff7','#bae5f9','#c8ebfb','#d6f1fc']
for i,c in enumerate(sky): d.rectangle([0,i*10,239,i*10+9],fill=hexc(c))
def cloud(x,y,w):
    for (dx,dy,r) in [(0,4,5),(6,0,7),(14,3,6),(20,5,4)]:
        d.ellipse([x+dx*w-r*w,y+dy-r,x+dx*w+r*w,y+dy+r],fill=(255,255,255))
    d.rectangle([x-4,y+5,x+22*w,y+9],fill=(255,255,255))
cloud(20,10,1); cloud(150,6,1); cloud(200,22,0.8)
for x in range(0,240,1):
    hgt=int(6+4*math.sin(x/9)+3*math.sin(x/4.3+1))
    d.line([(x,50-hgt),(x,60)],fill=hexc('#3f9b55'))
    d.point((x,50-hgt),fill=hexc('#5dbb67'))
d.rectangle([0,56,239,159],fill=hexc('#98d468'))
for y in range(60,160,7): d.line([(0,y),(239,y)],fill=hexc('#a9dd78'))
for _ in range(70):
    x=R.randrange(0,236); y=R.randrange(60,158); d.line([(x,y),(x+1,y-2),(x+2,y)],fill=hexc('#7fbf55'))
def plat(cx,cy,rx,ry):
    d.ellipse([cx-rx,cy-ry,cx+rx,cy+ry],fill=hexc('#6aaa48'))
    d.ellipse([cx-rx+3,cy-ry+2,cx+rx-3,cy+ry-3],fill=hexc('#8ccd5e'))
    d.ellipse([cx-rx+8,cy-ry+3,cx+rx-8,cy+ry-6],fill=hexc('#a3dc72'))
plat(176,66,50,13); plat(62,140,64,16)
bg.save(f'{OUT}/battle-bg.png')

# ---------- capture capsule 14x14, symmetric (original design) ----------
cap=grid([
"....oooooo....",
"..oottttttoo..",
".otllttttttto.",
".otltttttttto.",
"otttttttttttto",
"ottttooootttto",
"ooooooyyoooooo",
"ooooooyyoooooo",
"occccoooocccco",
"occcccccccccco",
".ocwwwwwwwwco.",
".occwwwwwwcco.",
"..ooccccccoo..",
"....oooooo....",
],{'o':'#203040','t':'#2fb8a8','l':'#bff3ea','y':'#ffd23f','c':'#d8d2c4','w':'#fbf8ef'})
cap.save(f'{OUT}/capsule.png')

# ---------- Minecraft-like textures & iso blocks ----------
def tex(fn):
    im=Image.new('RGB',(16,16)); p=im.load()
    for y in range(16):
        for x in range(16): p[x,y]=fn(x,y)
    return im
def noise(base,amt=0.12): return mul(hexc(base),1+R.uniform(-amt,amt))
bark=tex(lambda x,y: mul(hexc('#6b5133'),0.75) if (x*7+ (y//5)*3)%5==0 else noise('#6b5133',0.1))
def logtop(x,y):
    if x in(0,15) or y in(0,15): return noise('#6b5133',.08)
    r=max(abs(x-7.5),abs(y-7.5)); return hexc('#b8925c') if int(r)%2==0 else hexc('#a07c47')
logt=tex(logtop)
seeds=[(R.uniform(0,16),R.uniform(0,16),R.choice(['#8a8a8a','#9c9c9c','#7a7a7a','#acacac'])) for _ in range(9)]
def cobble(x,y):
    ds=sorted(((min(abs(x-a),16-abs(x-a))**2+min(abs(y-b),16-abs(y-b))**2,c) for a,b,c in seeds))
    if ds[1][0]-ds[0][0]<6: return hexc('#565656')
    return noise(ds[0][1],0.06)
cob=tex(cobble)
def plank(x,y):
    if y%4==3: return hexc('#7a5a30')
    if (x+(y//4)*5)%8==0 and y%4==1: return hexc('#8f6c3c')
    return noise('#b08a52',0.06)
pl=tex(plank)
def cttop(x,y):
    if x in(0,15) or y in(0,15): return hexc('#5c3f1f')
    if x in(5,10) or y in(5,10): return hexc('#6b4a26')
    return noise('#b5894e',0.05)
ctt=tex(cttop)
def ctside(x,y):
    c=plank(x,y)
    if y<3: return hexc('#5c3f1f') if y==0 else noise('#8a6233',.05)
    if 3<=x<=6 and 5<=y<=12: return hexc('#7b7b7b') if x==5 or y==5 else c  # saw
    if 9<=x<=12 and 6<=y<=7: return hexc('#8a8a8a')                            # hammer head
    if x==11 and 8<=y<=13: return hexc('#5c3f1f')
    return c
cts=tex(ctside)
def iso(top,left,right,size=32):
    W,H=32,34; out=Image.new('RGBA',(W,H),(0,0,0,0)); o=out.load()
    tp,lp,rp=top.load(),left.load(),right.load()
    for y in range(H):
        for x in range(W):
            X,Y=x+0.5,y+0.5
            u=(X-16+2*Y)/2; v=(2*Y-(X-16))/2
            if 0<=u<16 and 0<=v<16: o[x,y]=tp[int(u),int(v)]+(255,); continue
            if X<16:
                u=X; v=(Y-8-X/2)*16/18
                if 0<=u<16 and 0<=v<16: o[x,y]=mul(lp[int(u),int(v)],0.8)+(255,)
            else:
                u=X-16; v=(Y-16+u/2)*16/18
                if 0<=u<16 and 0<=v<16: o[x,y]=mul(rp[int(u),int(v)],0.62)+(255,)
    return out
iso(logt,bark,bark).save(f'{OUT}/mc-wood.png')
iso(cob,cob,cob).save(f'{OUT}/mc-stone.png')
iso(ctt,cts,pl).save(f'{OUT}/mc-table.png')
ING=["................","................","................","................",
".......oooooo...",".....ooaaaaaaoo.","...ooaaaaaaaaabo",".ooaaaaaaaaaabbo",
"oaaaaaaaaaaabbco","obbaaaaaaaabbcco","occbbbaaaabbccoo",".oocccbbbbcccoo.",
"...ooocccccoo...","......ooooo.....","................","................"]
grid(ING,{'o':'#3a3a3a','a':'#ececec','b':'#c8c8c8','c':'#9a9a9a'}).save(f'{OUT}/mc-iron.png')
grid(ING,{'o':'#5a3d00','a':'#fff27a','b':'#f2c52a','c':'#c88d10'}).save(f'{OUT}/mc-gold.png')
grid(["................","................","....oooooooo....","...oaaabbbaaco..","..oaaabbbbaacco.",".oaaabbbbbaaacco",
".oooooooooooooo.","..ocbbbbbbbbco..","...ocbbbbbbco...","....ocbbbbco....",".....ocbbco.....","......occo......",".......oo.......","................","................","................"],
 {'o':'#0f3e3a','a':'#d5fff6','b':'#4aedd9','c':'#1aaaa0'}).save(f'{OUT}/mc-diamond.png')
# dirt tile for UI backgrounds
def dirt(x,y):
    v=R.random()
    return hexc('#5b3f2b') if v<.18 else hexc('#866043') if v<.5 else hexc('#795539') if v<.85 else hexc('#a0785a')
tex(dirt).save(f'{OUT}/mc-dirt.png')

# ---------- platformer blocks ----------
QB=["oooooooooooooooo","ohhhhhhhhhhhhhho","ohdhhhhhhhhhhdso","ohhhhwwwwhhhhhso","ohhhwwsswwhhhhso","ohhhhhhhwwshhhso",
"ohhhhhhwwshhhhso","ohhhhhwwshhhhhso","ohhhhhwwshhhhhso","ohhhhhhsshhhhhso","ohhhhhwwhhhhhhso","ohhhhhwwshhhhhso",
"ohhhhhhsshhhhhso","ohdhhhhhhhhhhdso","osssssssssssssso","oooooooooooooooo"]
grid(QB,{'o':'#3b1e08','h':'#f7b21c','d':'#7a3e10','w':'#ffffff','s':'#c46a00'}).save(f'{OUT}/qblock.png')
grid(QB,{'o':'#3b1e08','h':'#ffd75e','d':'#7a3e10','w':'#ffffff','s':'#d88a10'}).save(f'{OUT}/qblock2.png')
grid([''.join('h' if 3<=x<=12 and 3<=y<=12 else ch for x,ch in enumerate(r)) for y,r in enumerate(QB)],{'o':'#3b1e08','h':'#a8622a','d':'#4a2a10','s':'#7a4018'}).save(f'{OUT}/qblock-used.png')
BR=["mmmmmmmmmmmmmmmm","bbbbbbbmbbbbbbbm","bbbbbbbmbbbbbbbm","bbbbbbbmbbbbbbbm","mmmmmmmmmmmmmmmm","bbbmbbbbbbbmbbbb","bbbmbbbbbbbmbbbb","bbbmbbbbbbbmbbbb",
"mmmmmmmmmmmmmmmm","bbbbbbbmbbbbbbbm","bbbbbbbmbbbbbbbm","bbbbbbbmbbbbbbbm","mmmmmmmmmmmmmmmm","bbbmbbbbbbbmbbbb","bbbmbbbbbbbmbbbb","bbbmbbbbbbbmbbbb"]
grid(BR,{'m':'#3a1a08','b':'#c8581c'}).save(f'{OUT}/brick.png')
for i,w in enumerate([10,7,3,7]):
    im=Image.new('RGBA',(12,16),(0,0,0,0)); dd=ImageDraw.Draw(im)
    x0=6-w//2-1; dd.ellipse([x0,0,x0+w+1,15],fill=hexc('#3b1e08')); 
    if w>2: dd.ellipse([x0+1,1,x0+w,14],fill=hexc('#ffc400')); dd.line([(6,4),(6,11)],fill=hexc('#c47a00')) if w>5 else None
    else: dd.line([(6,1),(6,14)],fill=hexc('#ffc400'))
    im.save(f'{OUT}/coin{i}.png')
print('ok')
