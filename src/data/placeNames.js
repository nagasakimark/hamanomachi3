// Japanese names for every place. Used by the wild-monster battles
// (English place name -> Japanese). Keys are the English names used in map.json.
export const PLACE_JA = {
  // the 18 buildings in Hamanomachi
  'post office': 'ゆうびんきょく', 'police station': 'けいさつしょ', 'hospital': 'びょういん',
  'supermarket': 'スーパー', 'bookstore': 'ほんや', 'flower shop': 'はなや',
  'convenience store 7/11': 'コンビニ', 'convenience store lawson': 'コンビニ',
  'ice cream shop': 'アイスやさん', 'castella shop': 'カステラや', 'department store': 'デパート',
  'sushi restaurant': 'おすしや', 'hotel': 'ホテル', 'tonkatsu restaurant': 'とんかつや',
  'soba restaurant': 'おそばや', 'chawanmushi restaurant': 'ちゃわんむしや', 'ramen restaurant': 'ラーメンや',
  'temple': 'おてら',
  // proposed new words for the themed maps (see hamanomachi_map_plan.xlsx)
  'park': 'こうえん', 'bakery': 'パンや', 'cafe': 'カフェ', 'school': 'がっこう', 'zoo': 'どうぶつえん',
  'train station': 'えき', 'library': 'としょかん', 'bank': 'ぎんこう', 'farm': 'のうじょう',
  'castle': 'おしろ', 'stadium': 'スタジアム', 'fire station': 'しょうぼうしょ',
  'museum': 'はくぶつかん', 'aquarium': 'すいぞくかん', 'gym': 'たいいくかん',
};
export const jaName = en => PLACE_JA[String(en || '').toLowerCase()] || null;
