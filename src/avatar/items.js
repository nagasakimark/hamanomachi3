// Wardrobe catalogue. Every item points at one or more LPC layer sheets
// (walk animation, 9 frames x 4 rows of 64x64). To add an item:
//  1. add its LPC path(s) here,
//  2. run `npm run fetch-lpc` to download them and update the credits.
//
// z = draw order (low first). price 0 = free starter item.
// badge = only unlocked by earning that sticker.
// feminine = can be used for the (always female) person asking the way.

import { PETS } from '../pets/petsData.js';

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
  { id: 'beard', name: 'ひげ', icon: '🧔' },
  { id: 'ears', name: 'みみ', icon: '🐱' },
  { id: 'arms', name: 'うで', icon: '🧤' },
  { id: 'pet', name: 'ペット', icon: '🐾' },
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
const hat = (id, name, price, path, { color = true, two = false, badge, gate } = {}) => ({
  id: 'hat-' + id, slot: 'hat', name, price, badge, gate, color: color ? 'cloth' : undefined,
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
  hat('rally', 'ラリーぼうし', 0, 'pirate/bonnie', { gate: 'rally' }),
  hat('craft-cap', 'マイナーぼうし', 0, 'cloth/leather_cap', { gate: 'craft' }),
  hat('craft-hood', 'てつのフード', 0, 'cloth/hood', { gate: 'craft' }),
  hat('craft-bonnie', 'ゴールドベレー', 0, 'pirate/bonnie', { gate: 'craft' }),
  hat('craft-horns', 'ダイヤのつの', 0, 'accessory/horns_short', { two: true, gate: 'craft' }),

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

// More LPC wearables (no weapons).
ITEMS.push(
  { id: "hair-bangs_bun", slot: "hair", name: "おだんごバング", price: 120, color: 'hair', layers: [L("hair/bangs_bun/adult/walk.png", Z.hair)] },
  { id: "hair-braid2", slot: "hair", name: "みつあみ2", price: 120, color: 'hair', layers: [L("hair/braid2/adult/bg/walk.png", Z.hairBg), L("hair/braid2/adult/fg/walk.png", Z.hair)] },
  { id: "hair-flat_top_fade", slot: "hair", name: "フラットトップ", price: 120, color: 'hair', layers: [L("hair/flat_top_fade/adult/walk.png", Z.hair)] },
  { id: "hair-high_and_tight", slot: "hair", name: "ベリーショート", price: 60, color: 'hair', layers: [L("hair/high_and_tight/adult/walk.png", Z.hair)] },
  { id: "hair-long_messy", slot: "hair", name: "ロングぼさぼさ", price: 120, color: 'hair', layers: [L("hair/long_messy/adult/walk.png", Z.hair)] },
  { id: "hair-ponytail2", slot: "hair", name: "ポニーテール2", price: 120, color: 'hair', layers: [L("hair/ponytail2/adult/bg/walk.png", Z.hairBg), L("hair/ponytail2/adult/fg/walk.png", Z.hair)] },
  { id: "hair-shorthawk", slot: "hair", name: "ショートモヒカン", price: 250, color: 'hair', layers: [L("hair/shorthawk/adult/walk.png", Z.hair)] },
  { id: "hair-spiked_beehive", slot: "hair", name: "ツンツンハイ", price: 250, color: 'hair', layers: [L("hair/spiked_beehive/adult/walk.png", Z.hair)] },
  { id: "hair-curls_large", slot: "hair", name: "おおきなカール", price: 250, color: 'hair', layers: [L("hair/curls_large/adult/bg/walk.png", Z.hairBg), L("hair/curls_large/adult/fg/walk.png", Z.hair)] },
  { id: "hair-bob_side_part", slot: "hair", name: "ボブ2", price: 60, color: 'hair', layers: [L("hair/bob_side_part/adult/walk.png", Z.hair)] },
  { id: "hair-parted2", slot: "hair", name: "わけめ2", price: 60, color: 'hair', layers: [L("hair/parted2/adult/walk.png", Z.hair)] },
  { id: "hair-natural", slot: "hair", name: "ナチュラル", price: 120, color: 'hair', layers: [L("hair/natural/adult/walk.png", Z.hair)] },
  { id: "hair-loose", slot: "hair", name: "ゆるふわ", price: 120, color: 'hair', layers: [L("hair/loose/adult/walk.png", Z.hair)] },
  { id: "hair-dreadlocks_short", slot: "hair", name: "ドレッド", price: 250, color: 'hair', layers: [L("hair/dreadlocks_short/adult/walk.png", Z.hair)] },
  { id: "hair-curtains_long", slot: "hair", name: "ながいセンターわけ", price: 120, color: 'hair', layers: [L("hair/curtains_long/adult/walk.png", Z.hair)] },
  { id: "hair-relm_ponytail", slot: "hair", name: "ポニーテール3", price: 120, color: 'hair', layers: [L("hair/relm_ponytail/adult/bg/walk.png", Z.hairBg), L("hair/relm_ponytail/adult/fg/walk.png", Z.hair)] },
  { id: "beard-basic", slot: "beard", name: "ひげ", price: 150, color: 'hair', layers: [L("beards/beard/basic/walk.png", Z.head + 2)] },
  { id: "beard-medium", slot: "beard", name: "ながいひげ", price: 200, color: 'hair', layers: [L("beards/beard/medium/walk.png", Z.head + 2)] },
  { id: "beard-trimmed", slot: "beard", name: "きれいなひげ", price: 150, color: 'hair', layers: [L("beards/beard/trimmed/walk.png", Z.head + 2)] },
  { id: "beard-winter", slot: "beard", name: "もじゃもじゃひげ", price: 300, color: 'hair', layers: [L("beards/beard/winter/female/walk.png", Z.head + 2)] },
  { id: "beard-5oclock_shadow", slot: "beard", name: "ぶしょうひげ", price: 120, color: 'hair', layers: [L("beards/beard/5oclock_shadow/walk.png", Z.head + 2)] },
  { id: "beard-basic", slot: "beard", name: "ちょびひげ", price: 120, color: 'hair', layers: [L("beards/mustache/basic/walk.png", Z.head + 2)] },
  { id: "beard-bigstache", slot: "beard", name: "おおきなヒゲ", price: 200, color: 'hair', layers: [L("beards/mustache/bigstache/walk.png", Z.head + 2)] },
  { id: "beard-chevron", slot: "beard", name: "ハの字ひげ", price: 150, color: 'hair', layers: [L("beards/mustache/chevron/walk.png", Z.head + 2)] },
  { id: "beard-french", slot: "beard", name: "フレンチひげ", price: 150, color: 'hair', layers: [L("beards/mustache/french/walk.png", Z.head + 2)] },
  { id: "beard-handlebar", slot: "beard", name: "カールひげ", price: 250, color: 'hair', layers: [L("beards/mustache/handlebar/walk.png", Z.head + 2)] },
  { id: "beard-horseshoe", slot: "beard", name: "Uの字ひげ", price: 150, color: 'hair', layers: [L("beards/mustache/horseshoe/walk.png", Z.head + 2)] },
  { id: "beard-lampshade", slot: "beard", name: "ランプひげ", price: 200, color: 'hair', layers: [L("beards/mustache/lampshade/walk.png", Z.head + 2)] },
  { id: "beard-walrus", slot: "beard", name: "セイウチひげ", price: 250, color: 'hair', layers: [L("beards/mustache/walrus/walk.png", Z.head + 2)] },
  { id: "hat-helmet_barbarian_viking", slot: "hat", name: "バイキング", price: 400, layers: [L("hat/helmet/barbarian_viking/adult/walk.png", Z.hatFg)] },
  { id: "hat-helmet_kettle", slot: "hat", name: "てつぼうし", price: 350, layers: [L("hat/helmet/kettle/adult/walk.png", Z.hatFg)] },
  { id: "hat-helmet_greathelm", slot: "hat", name: "ナイトヘルム", price: 500, layers: [L("hat/helmet/greathelm/female/walk.png", Z.hatFg)] },
  { id: "hat-helmet_horned", slot: "hat", name: "つのヘルム", price: 450, layers: [L("hat/helmet/horned/adult/walk.png", Z.hatFg)] },
  { id: "hat-helmet_spangenhelm", slot: "hat", name: "ぎんのかぶと", price: 400, layers: [L("hat/helmet/spangenhelm/adult/walk.png", Z.hatFg)] },
  { id: "hat-helmet_pointed", slot: "hat", name: "とがりかぶと", price: 350, layers: [L("hat/helmet/pointed/adult/walk.png", Z.hatFg)] },
  { id: "hat-helmet_morion", slot: "hat", name: "モリオン", price: 400, layers: [L("hat/helmet/morion/adult/walk.png", Z.hatFg)] },
  { id: "hat-helmet_sugarloaf", slot: "hat", name: "まるかぶと", price: 350, layers: [L("hat/helmet/sugarloaf/female/walk.png", Z.hatFg)] },
  { id: "hat-magic_celestial_moon", slot: "hat", name: "つきのぼうし", price: 500, layers: [L("hat/magic/celestial_moon/adult/walk.png", Z.hatFg)] },
  { id: "hat-pirate_bandana_skull", slot: "hat", name: "ドクロバンダナ", price: 250, layers: [L("hat/pirate/bandana/skull/adult/walk.png", Z.hatFg)] },
  { id: "hat-pirate_bonnie_feather", slot: "hat", name: "はねつきベレー", price: 350, layers: [L("hat/pirate/bonnie/feather/adult/walk.png", Z.hatFg)] },
  { id: "hat-cloth_hood_sack", slot: "hat", name: "ずきん", price: 200, layers: [L("hat/cloth/hood_sack/adult/walk.png", Z.hatFg)] },
  { id: "hat-headband_hairtie", slot: "hat", name: "ヘアタイ", price: 100, layers: [L("hat/headband/hairtie/adult/walk.png", Z.hatFg)] },
  { id: "ears-cat", slot: "ears", name: "ねこみみ", price: 300, layers: [L("head/ears/cat/adult/bg/walk.png", Z.hairBg), L("head/ears/cat/adult/fg/walk.png", Z.hatFg)] },
  { id: "ears-wolf", slot: "ears", name: "おおかみみみ", price: 300, layers: [L("head/ears/wolf/adult/bg/walk.png", Z.hairBg), L("head/ears/wolf/adult/fg/walk.png", Z.hatFg)] },
  { id: "ears-elven", slot: "ears", name: "エルフみみ", price: 300, layers: [L("head/ears/elven/adult/walk.png", Z.hatFg)] },
  { id: "ears-long", slot: "ears", name: "うさみみ", price: 300, layers: [L("head/ears/long/adult/walk.png", Z.hatFg)] },
  { id: "ears-dragon", slot: "ears", name: "ドラゴンみみ", price: 350, layers: [L("head/ears/dragon/adult/walk.png", Z.hatFg)] },
  { id: "ears-big", slot: "ears", name: "おおきなみみ", price: 250, layers: [L("head/ears/big/adult/walk.png", Z.hatFg)] },
  { id: "top-jacket_santa", slot: "top", name: "サンタふく", price: 300, layers: [L("torso/jacket/santa/male/walk.png", Z.top)] },
  { id: "top-armour_leather", slot: "top", name: "かわのよろい", price: 400, layers: [L("torso/armour/leather/teen/walk.png", Z.top)] },
  { id: "top-chainmail", slot: "top", name: "くさりかたびら", price: 450, layers: [L("torso/chainmail/female/walk.png", Z.top)] },
  { id: "bottom-hose", slot: "bottom", name: "タイツ", price: 100, color: 'cloth', layers: [L("legs/hose/thin/walk.png", Z.bottom)] },
  { id: "shoes-socks_ankle", slot: "shoes", name: "くつした", price: 60, color: 'cloth', layers: [L("feet/socks/ankle/thin/walk.png", Z.shoes + 1)] },
  { id: "shoes-socks_high", slot: "shoes", name: "ハイソックス", price: 80, color: 'cloth', layers: [L("feet/socks/high/thin/walk.png", Z.shoes + 1)] },
  { id: "shoes-socks_tabi", slot: "shoes", name: "たび", price: 100, color: 'cloth', layers: [L("feet/socks/tabi/thin/walk.png", Z.shoes + 1)] },
  { id: "shoes-hoofs", slot: "shoes", name: "ひづめ", price: 200, color: 'cloth', layers: [L("feet/hoofs/thin/walk.png", Z.shoes + 1)] },
  { id: "neck-tie_necktie", slot: "neck", name: "ネクタイ", price: 120, layers: [L("neck/tie/necktie/female/walk.png", Z.neck)] },
  { id: "neck-cravat", slot: "neck", name: "クラバット", price: 150, layers: [L("neck/cravat/thin/walk.png", Z.neck)] },
  { id: "neck-jabot", slot: "neck", name: "ジャボ", price: 200, layers: [L("neck/jabot/thin/walk.png", Z.neck)] },
  { id: "neck-necklace_chain", slot: "neck", name: "チェーン", price: 200, layers: [L("neck/necklace/chain/female/walk.png", Z.neck)] },
  { id: "neck-amulet_star", slot: "neck", name: "ほしのおまもり", price: 250, layers: [L("neck/amulet/star/female/walk.png", Z.neck)] },
  { id: "neck-amulet_dangle", slot: "neck", name: "ペンダント", price: 250, layers: [L("neck/amulet/dangle/female/walk.png", Z.neck)] },
  { id: "neck-gem_pearl", slot: "neck", name: "パールのくびかざり", price: 300, layers: [L("neck/gem/pearl/female/walk.png", Z.neck)] },
  { id: "neck-gem_emerald", slot: "neck", name: "エメラルド", price: 350, layers: [L("neck/gem/emerald/female/walk.png", Z.neck)] },
  { id: "neck-earrings_emerald", slot: "neck", name: "エメラルドイヤリング", price: 250, layers: [L("facial/earrings/emerald/female/walk.png", Z.glasses)] },
  { id: "neck-earrings_moon", slot: "neck", name: "つきイヤリング", price: 250, layers: [L("facial/earrings/moon/female/walk.png", Z.glasses)] },
  { id: "neck-earrings_pear", slot: "neck", name: "しずくイヤリング", price: 250, layers: [L("facial/earrings/pear/female/walk.png", Z.glasses)] },
  { id: "neck-earrings_princess", slot: "neck", name: "プリンセスイヤリング", price: 300, layers: [L("facial/earrings/princess/female/walk.png", Z.glasses)] },
  { id: "neck-earrings_stud", slot: "neck", name: "ピアス", price: 150, layers: [L("facial/earrings/stud/female/walk.png", Z.glasses)] },
  { id: "glasses-masks_plain", slot: "glasses", name: "マスク", price: 150, layers: [L("facial/masks/plain/adult/walk.png", Z.glasses)] },
  { id: "arms-hands_gloves", slot: "arms", name: "てぶくろ", price: 150, color: 'cloth', layers: [L("arms/hands/gloves/thin/walk.png", Z.overTop)] },
  { id: "arms-bracers", slot: "arms", name: "ブレーサー", price: 200, color: 'cloth', layers: [L("arms/bracers/thin/walk.png", Z.overTop)] },
  { id: "arms-wrists_cuffs", slot: "arms", name: "カフス", price: 150, color: 'cloth', layers: [L("arms/wrists/cuffs/thin/walk.png", Z.overTop)] },
  { id: "arms-wrists_lace", slot: "arms", name: "レースカフス", price: 200, color: 'cloth', layers: [L("arms/wrists/lace/thin/walk.png", Z.overTop)] },
);

// Pets follow you on the map; they have no avatar layers.
ITEMS.push(...PETS.map(p => ({ id: 'pet-' + p.id, slot: 'pet', name: p.name, en: p.en, price: p.price, layers: [] })));

// ---- Price balance -------------------------------------------------------
// Kids earn coins fast, so the cool stuff is the long-term goal. Cheap items
// are small treats; the best items are big saves. Edit COOL to tune.
const COOL = {
  'hat-tiara': 5000, 'hat-admiral': 5000, 'hat-captain': 4500, 'back-cape': 4500, 'hat-wings': 4000,
  'hat-celestial': 4000, 'hat-magic_celestial_moon': 4000, 'ears-dragon': 3500, 'hat-helmet_greathelm': 4500,
  'hat-helmet_horned': 3500, 'back-tattered': 3000, 'hair-longhawk': 2500, 'hair-porcupine': 2500, 'top-chainmail': 3000,
  'neck-gem_emerald': 2500, 'neck-gem_pearl': 2000, 'hat-cavalier': 3000, 'hat-pirate': 2500, 'hat-horns': 2500,
};
for (const it of ITEMS) {
  if (!it.price || it.badge || it.slot === 'pet') continue;
  const p = it.price, k = p < 150 ? 1.5 : p < 250 ? 3 : p < 350 ? 5 : p < 450 ? 6 : 8;
  it.price = COOL[it.id] ?? Math.round(p * k / 10) * 10;
}

// Colours are bought once and then work on every item of that kind
// (id 'col-hair-7' / 'col-cloth-9'). The first colour of each list is free.
export const HAIR_PRICES = [0, 100, 100, 150, 200, 300, 500, 800, 800, 800];
export const CLOTH_PRICES = [0, 100, 150, 150, 150, 150, 200, 150, 250, 250, 100, 200];
export const colorItem = (kind, i) => ({ id: `col-${kind}-${i}`, slot: kind, name: kind === 'hair' ? 'かみのいろ' : 'ふくのいろ', price: (kind === 'hair' ? HAIR_PRICES : CLOTH_PRICES)[i] || 0 });

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
