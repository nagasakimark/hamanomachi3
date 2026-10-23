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
  // the 29 new buildings for the themed maps (see the map plan)
  'house': 'いえ', 'park': 'こうえん', 'station': 'えき', 'zoo': 'どうぶつえん', 'castle': 'おしろ', 'farm': 'のうじょう',
  'library': 'としょかん', 'bank': 'ぎんこう', 'museum': 'はくぶつかん', 'fire station': 'しょうぼうしょ', 'stadium': 'スタジアム', 'tower': 'タワー',
  'church': 'きょうかい', 'shrine': 'じんじゃ', 'aquarium': 'すいぞくかん', 'theater': 'げきじょう', 'garden': 'にわ', 'dome': 'ドーム',
  'elementary school': 'しょうがっこう', 'junior high school': 'ちゅうがっこう', 'kindergarten': 'ようちえん', 'city hall': 'しやくしょ',
  'amusement park': 'ゆうえんち', 'shopping mall': 'ショッピングモール',
  'factory': 'こうじょう', 'dam': 'ダム', 'airport': 'くうこう', 'planetarium': 'プラネタリウム', 'gas station': 'ガソリンスタンド',
};
export const jaName = en => PLACE_JA[String(en || '').toLowerCase()] || null;
