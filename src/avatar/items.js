// Wardrobe catalogue. Every item points at one or more LPC layer sheets
// (walk animation, 9 frames x 4 rows of 64x64). To add an item:
//  1. add its LPC path(s) here,
//  2. run `npm run fetch-lpc` to download them and update the credits.
//
// z = draw order (low first). price 0 = free starter item.
// badge = only unlocked by earning that sticker.
// feminine = can be used for the (always female) person asking the way.

export const SLOTS = [
  { id: 'skin', name: 'はだ', icon: '🖐️' },
  { id: 'face', name: 'タイプ', icon: '🙂' },
  { id: 'hair', name: 'かみ', icon: '💇' },
  { id: 'top', name: 'トップス', icon: '👕' },
  { id: 'bottom', name: 'ボトムス', icon: '👖' },
  { id: 'shoes', name: 'くつ', icon: '👟' },
  { id: 'hat', name: 'ぼうし', icon: '🎩' },
  { id: 'glasses', name: 'めがね', icon: '👓' },
  { id: 'neck', name: 'アクセ', icon: '🧣' },
  { id: 'back', name: 'せなか', icon: '🦸' },
];

// Which slots must always have something on.
export const REQUIRED = new Set(['skin', 'face', 'hair', 'top', 'bottom', 'shoes']);

const Z = { capeBg: 1, hairBg: 2, backBg: 3, body: 10, shoes: 20, bottom: 30, top: 40, overTop: 45, neck: 50, head: 60, glasses: 70, hair: 80, hat: 90, hatFg: 92, capeFg: 95 };
const L = (path, z) => ({ path, z });
const hair = (id, name, price, path, { two = false, feminine = false } = {}) => ({
  id: 'hair-' + id, slot: 'hair', name, price, color: 'hair', feminine,
  layers: two ? [L(`hair/${path}/adult/bg/walk.png`, Z.hairBg), L(`hair/${path}/adult/fg/walk.png`, Z.hair)] : [L(`hair/${path}/adult/walk.png`, Z.hair)],
});
const top = (id, name, price, path, extra = {}) => ({ id: 'top-' + id, slot: 'top', name, price, color: 'cloth', layers: [L(`torso/${path}/teen/walk.png`, Z.top)], ...extra });
const bottom = (id, name, price, path, extra = {}) => ({ id: 'bottom-' + id, slot: 'bottom', name, price, color: 'cloth', layers: [L(`legs/${path}/thin/walk.png`, Z.bottom)], ...extra });
const shoes = (id, name, price, path) => ({ id: 'shoes-' + id, slot: 'shoes', name, price, color: 'cloth', layers: [L(`feet/${path}/thin/walk.png`, Z.shoes)] });
const hat = (id, name, price, path, { color = true, two = false, badge } = {}) => ({
  id: 'hat-' + id, slot: 'hat', name, price, badge, color: color ? 'cloth' : undefined,
  layers: two ? [L(`hat/${path}/bg/adult/walk.png`, Z.hairBg), L(`hat/${path}/fg/adult/walk.png`, Z.hatFg)] : [L(`hat/${path}/adult/walk.png`, Z.hat)],
});
const glasses = (id, name, price, path) => ({ id: 'glasses-' + id, slot: 'glasses', name, price, layers: [L(`facial/${path}/adult/walk.png`, Z.glasses)] });

export const ITEMS = [
  // "Type": boy or girl head. Skin colour is applied to body + head together.
  { id: 'face-a', slot: 'face', name: '男の子', price: 0, layers: [L('head/heads/human/male_small/walk.png', Z.head)], skin: true },
  { id: 'face-b', slot: 'face', name: '女の子', price: 0, layers: [L('head/heads/human/female_small/walk.png', Z.head)], skin: true, feminine: true },

  // Hair: everyday styles are free or cheap for everyone; wild styles cost more.
  hair('plain', 'ふつう', 0, 'plain'),
  hair('bangs', 'まえがみ', 0, 'bangs', { feminine: true }),
  hair('bob', 'ボブ', 0, 'bob', { feminine: true }),
  hair('ponytail', 'ポニーテール', 0, 'ponytail', { two: true, feminine: true }),
  hair('buzz', 'ぼうず', 0, 'buzzcut'),
  hair('messy', 'ぼさぼさ', 0, 'messy1'),
  hair('parted', 'わけめ', 0, 'parted'),
  hair('long', 'ロング', 0, 'long', { feminine: true }),
  hair('messy2', 'ふわふわ', 60, 'messy2'),
  hair('bedhead', 'ねぐせ', 60, 'bedhead'),
  hair('bangsshort', 'みじかいまえがみ', 60, 'bangsshort', { feminine: true }),
  hair('pixie', 'ショート', 60, 'pixie', { feminine: true }),
  hair('page', 'マッシュ', 60, 'page', { feminine: true }),
  hair('relmshort', 'さらさら', 60, 'relm_short'),
  hair('mop', 'モップ', 60, 'mop'),
  hair('swoop', 'サイドながし', 60, 'swoop'),
  hair('lob', 'ロブ', 60, 'lob', { feminine: true }),
  hair('longstraight', 'ストレート', 60, 'long_straight', { feminine: true }),
  hair('pigtails', 'ツインテール', 60, 'pigtails', { feminine: true }),
  hair('cowlick', 'アホげ', 120, 'cowlick'),
  hair('unkempt', 'ワイルド', 120, 'unkempt'),
  hair('curtains', 'センターわけ', 120, 'curtains'),
  hair('halfup', 'ハーフアップ', 120, 'half_up', { feminine: true }),
  hair('bangslong', 'ながいまえがみ', 120, 'bangslong', { feminine: true }),
  hair('curly', 'くるくる', 120, 'curly_short'),
  hair('idol', 'アイドル', 120, 'idol'),
  hair('highpony', 'たかいポニー', 120, 'high_ponytail', { two: true, feminine: true }),
  hair('bunches', 'おだんご', 120, 'bunches', { two: true, feminine: true }),
  hair('braid', 'みつあみ', 120, 'braid', { two: true, feminine: true }),
  hair('wavy', 'ウェーブ', 120, 'wavy', { two: true, feminine: true }),
  hair('curlylong', 'ロングカール', 120, 'curly_long', { feminine: true }),
  hair('afro', 'アフロ', 250, 'afro'),
  hair('spiky', 'ツンツン', 250, 'spiked'),
  hair('spiky2', 'ツンツン2', 250, 'spiked2'),
  hair('sara', 'サラ', 250, 'sara', { two: true, feminine: true }),
  hair('xlong', 'スーパーロング', 300, 'xlong', { two: true, feminine: true }),
  hair('princess', 'プリンセス', 300, 'princess', { two: true, feminine: true }),
  hair('longhawk', 'モヒカン', 350, 'longhawk'),
  hair('porcupine', 'ハリネズミ', 350, 'spiked_porcupine'),

  // Tops
  top('tshirt', 'Tシャツ', 0, 'clothes/shortsleeve/tshirt'),
  top('longsleeve', 'ながそで', 0, 'clothes/longsleeve/longsleeve'),
  top('vneck', 'Vネック', 60, 'clothes/shortsleeve/tshirt_vneck'),
  top('scoop', 'まるえり', 60, 'clothes/shortsleeve/tshirt_scoop'),
  top('tank', 'タンクトップ', 80, 'clothes/sleeveless/sleeveless2'),
  top('buttoned', 'ボタンシャツ', 80, 'clothes/shortsleeve/tshirt_buttoned'),
  top('polo', 'ポロシャツ', 100, 'clothes/shortsleeve/shortsleeve_polo'),
  top('tankpolo', 'ノースリーブポロ', 100, 'clothes/sleeveless/sleeveless2_polo'),
  top('lsvneck', 'ながそでVネック', 100, 'clothes/longsleeve/longsleeve2_vneck'),
  top('lspolo', 'ながそでポロ', 120, 'clothes/longsleeve/longsleeve2_polo'),
  top('lsbuttoned', 'ながそでシャツ', 120, 'clothes/longsleeve/longsleeve2_buttoned'),
  top('sscardigan', 'はんそでカーディガン', 150, 'clothes/shortsleeve/shortsleeve_cardigan'),
  top('cardigan', 'カーディガン', 180, 'clothes/longsleeve/longsleeve2_cardigan'),
  { id: 'top-suspenders', slot: 'top', name: 'サスペンダー', price: 220, color: 'cloth', color2: true, layers: [L('torso/clothes/longsleeve/longsleeve/teen/walk.png', Z.top), L('torso/aprons/suspenders/teen/walk.png', Z.overTop)] },
  { id: 'top-overalls', slot: 'top', name: 'オーバーオール', price: 250, color: 'cloth', color2: true, layers: [L('torso/clothes/shortsleeve/tshirt/teen/walk.png', Z.top), L('torso/aprons/overalls/teen/walk.png', Z.overTop)] },
  { id: 'top-vest', slot: 'top', name: 'たんけんベスト', price: 400, color: 'cloth', color2: true, layers: [L('torso/clothes/longsleeve/longsleeve/teen/walk.png', Z.top), L('torso/armour/leather/teen/walk.png', Z.overTop)] },

  // Bottoms
  bottom('pants', 'ズボン', 0, 'pants'),
  bottom('shorts', 'はんズボン', 0, 'shorts/shorts'),
  bottom('skirt', 'スカート', 0, 'skirts/plain', { feminine: true }),
  bottom('pants2', 'チノパン', 80, 'pants2'),
  bottom('shortshorts', 'ショートパンツ', 80, 'shorts/short_shorts'),
  bottom('leggings', 'レギンス', 80, 'leggings', { feminine: true }),
  bottom('leggings2', 'スパッツ', 100, 'leggings2'),
  bottom('cuffed', 'ジーンズ', 120, 'cuffed'),
  bottom('straight', 'タイトスカート', 120, 'skirts/straight', { feminine: true }),
  bottom('formal', 'スラックス', 150, 'formal'),
  bottom('pantaloons', 'ふんわりパンツ', 180, 'pantaloons'),
  bottom('overskirt', 'かさねスカート', 200, 'skirts/overskirt', { feminine: true }),
  bottom('striped', 'しましまズボン', 200, 'formal_striped'),
  bottom('belle', 'ロングスカート', 250, 'skirts/belle', { feminine: true }),

  // Shoes
  shoes('basic', 'スニーカー', 0, 'shoes/basic'),
  shoes('sandals', 'サンダル', 60, 'sandals'),
  shoes('slippers', 'スリッパ', 60, 'slippers'),
  shoes('revised', 'ローファー', 100, 'shoes/revised'),
  shoes('boots', 'ブーツ', 120, 'boots/basic'),
  shoes('ghillies', 'レースアップ', 150, 'shoes/ghillies'),
  shoes('fold', 'おりかえしブーツ', 150, 'boots/fold'),
  shoes('rimmed', 'ぼうけんブーツ', 180, 'boots/rimmed'),

  // Hats
  hat('headband', 'ヘアバンド', 120, 'headband/thick'),
  hat('tied', 'はちまき', 120, 'headband/tied'),
  hat('bandana', 'バンダナ', 120, 'cloth/bandana'),
  hat('bandana2', 'バンダナ2', 120, 'cloth/bandana2'),
  hat('kerchief', 'スカーフ', 150, 'pirate/kerchief'),
  hat('cap', 'キャップ', 150, 'cloth/leather_cap'),
  hat('hood', 'フード', 200, 'cloth/hood'),
  hat('capfeather', 'はねつきぼうし', 220, 'cloth/leather_cap/feather'),
  hat('bowler', 'まるいぼうし', 250, 'formal/bowler'),
  hat('christmas', 'クリスマス', 250, 'holiday/christmas'),
  hat('elf', 'エルフ', 250, 'holiday/elf'),
  hat('bonnie', 'ベレー', 280, 'pirate/bonnie'),
  hat('santa', 'サンタ', 300, 'holiday/santa'),
  hat('horns', 'つの', 350, 'accessory/horns_short', { two: true }),
  hat('pirate', 'かいぞく', 350, 'pirate/tricorne/basic'),
  hat('cavalier', 'きしのぼうし', 400, 'pirate/cavalier/feather'),
  hat('captain', 'せんちょう', 500, 'pirate/tricorne/captain'),
  hat('celestial', 'ほしのぼうし', 500, 'magic/celestial'),
  hat('wings', 'はねかざり', 500, 'accessory/wings', { two: true, color: false }),
  hat('admiral', 'ていとく', 600, 'pirate/bicorne/athwart/admiral'),
  hat('tiara', 'ティアラ', 600, 'formal/tiara', { color: false }),
  hat('tophat', 'シルクハット', 0, 'formal/tophat', { badge: 'efficient' }),
  hat('wizard', 'まほうつかい', 0, 'magic/wizard/base', { badge: 'listener' }),
  hat('crown', 'おうかん', 0, 'formal/crown', { color: false, badge: 'expert' }),

  // Glasses
  glasses('round', 'まるめがね', 100, 'glasses/round'),
  glasses('classic', 'めがね', 100, 'glasses/glasses'),
  glasses('nerd', 'おおきいめがね', 150, 'glasses/nerd'),
  glasses('secretary', 'おしゃれめがね', 150, 'glasses/secretary'),
  glasses('halfmoon', 'はんげつめがね', 150, 'glasses/halfmoon'),
  glasses('patch', 'がんたい', 200, 'patches/eyepatch/ambi'),
  glasses('shades', 'サングラス', 250, 'glasses/shades'),
  glasses('sun', 'スターグラス', 250, 'glasses/sunglasses'),

  // Neck / accessories
  { id: 'neck-bowtie', slot: 'neck', name: 'ちょうネクタイ', price: 120, color: 'cloth', layers: [L('neck/tie/bowtie/adult/walk.png', Z.neck)] },
  { id: 'neck-bowtie2', slot: 'neck', name: 'リボン', price: 120, color: 'cloth', layers: [L('neck/tie/bowtie2/adult/walk.png', Z.neck)] },
  { id: 'neck-scarf', slot: 'neck', name: 'マフラー', price: 150, color: 'cloth', layers: [L('neck/scarf/walk.png', Z.neck)] },
  { id: 'neck-beads', slot: 'neck', name: 'ネックレス', price: 200, layers: [L('neck/necklace/beaded_small/thin/walk.png', Z.neck)] },
  { id: 'neck-beadsbig', slot: 'neck', name: 'おおきいネックレス', price: 250, layers: [L('neck/necklace/beaded_large/thin/walk.png', Z.neck)] },
  { id: 'neck-earrings', slot: 'neck', name: 'イヤリング', price: 200, layers: [L('facial/earrings/simple/left/adult/walk.png', Z.glasses), L('facial/earrings/simple/right/adult/walk.png', Z.glasses)] },

  // Back
  { id: 'back-cape', slot: 'back', name: 'ヒーローマント', price: 500, color: 'cloth', layers: [L('cape/solid/bg/walk.png', Z.capeBg), L('cape/solid/fg/walk.png', Z.capeFg)] },
  { id: 'back-tattered', slot: 'back', name: 'ボロボロマント', price: 400, color: 'cloth', layers: [L('cape/tattered/bg/walk.png', Z.capeBg), L('cape/tattered/fg/walk.png', Z.capeFg)] },
];

export const BODY_LAYER = L('body/bodies/teen/walk.png', Z.body);

// Colour choices. Skin/hair/cloth colours are free to change.
export const SKIN_TONES = ['#fbd7b7', '#f1c09b', '#d9a07a', '#b97d57', '#8d5a3b', '#613d2a'];
export const HAIR_COLORS = ['#2b2320', '#5a3825', '#9a5b2e', '#d9a441', '#f0d27a', '#b8b8c0', '#e05a5a', '#e98fc2', '#6f7fe8', '#57b87a'];
export const CLOTH_COLORS = ['#f5f1e6', '#3a3f4b', '#e8514a', '#f39a3c', '#f6d04d', '#6cc36a', '#3fb5c9', '#4a78d6', '#9b6ad6', '#f08fb6', '#8b5a3c', '#1f7a5a'];

export const itemById = id => ITEMS.find(i => i.id === id);
export const allLayerPaths = () => [BODY_LAYER.path, ...new Set(ITEMS.flatMap(i => i.layers.map(l => l.path)))];

export const STARTER = {
  skin: 0,
  face: 'face-a',
  hair: 'hair-plain', hairColor: 1,
  top: 'top-tshirt', topColor: 3, topColor2: 7,
  bottom: 'bottom-pants', bottomColor: 7,
  shoes: 'shoes-basic', shoesColor: 1,
  hat: null, hatColor: 2,
  glasses: null,
  neck: null, neckColor: 2,
  back: null, backColor: 2,
};

// Picking 男の子 / 女の子 swaps in these free defaults, unless the player has
// already chosen something else themselves.
export const TYPE_DEFAULTS = {
  'face-a': { hair: 'hair-plain', bottom: 'bottom-pants' },
  'face-b': { hair: 'hair-long', bottom: 'bottom-skirt', hairColor: 1 },
};
