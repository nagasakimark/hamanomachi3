// Pet catalogue (plain data, so node scripts can import it).
// price = coins for the pet itself; colours cost extra (PET_COLORS).
export const PETS = [
  { "id": "cat-black", "name": "くろねこ", "price": 2500, "frames": 6, "scale": 0.62, "en": "Black Cat" },
  { "id": "cat-orange", "name": "ちゃとら", "price": 2500, "frames": 6, "scale": 0.62, "en": "Orange Cat" },
  { "id": "cat-grey", "name": "はいいろねこ", "price": 2500, "frames": 6, "scale": 0.62, "en": "Grey Cat" },
  { "id": "fox", "name": "キツネ", "price": 3500, "frames": 6, "scale": 0.85, "en": "Fox" },
  { "id": "hare", "name": "うさぎ", "price": 3000, "frames": 5, "scale": 0.85, "en": "Hare" },
  { "id": "deer", "name": "シカ", "price": 3500, "frames": 6, "scale": 0.85, "en": "Deer" },
  { "id": "sheep", "name": "ひつじ", "price": 2000, "frames": 6, "scale": 0.85, "en": "Sheep" },
  { "id": "lamb", "name": "こひつじ", "price": 1800, "frames": 6, "scale": 0.85, "en": "Lamb" },
  { "id": "piglet", "name": "こぶた", "price": 1500, "frames": 6, "scale": 0.85, "en": "Piglet" },
  { "id": "chick", "name": "ひよこ", "price": 1200, "frames": 6, "scale": 0.85, "en": "Chick" },
  { "id": "rooster", "name": "にわとり", "price": 1800, "frames": 6, "scale": 0.85, "en": "Rooster" },
  { "id": "turkey", "name": "シチメンチョウ", "price": 2200, "frames": 6, "scale": 0.85, "en": "Turkey" },
  { "id": "slime1", "name": "みどりスライム", "price": 1500, "frames": 8, "scale": 0.9, "en": "Green Slime" },
  { "id": "slime2", "name": "あおスライム", "price": 1500, "frames": 8, "scale": 0.9, "en": "Blue Slime" },
  { "id": "slime3", "name": "あかスライム", "price": 1500, "frames": 8, "scale": 0.9, "en": "Red Slime" }
];

// Colour variants. fx is applied to the sheet pixels (see pets.js recolor).
export const PET_COLORS = [
  { id: 'natural', en: 'Natural', jp: 'ふつう', price: 0, dot: '#c9a57a' },
  { id: 'blue', en: 'Blue', jp: 'あお', price: 300, dot: '#4a78d6', fx: { hue: 215, sat: 0.7 } },
  { id: 'green', en: 'Green', jp: 'みどり', price: 300, dot: '#6cc36a', fx: { hue: 120, sat: 0.6 } },
  { id: 'pink', en: 'Pink', jp: 'ピンク', price: 500, dot: '#f08fb6', fx: { hue: 330, sat: 0.75, light: 1.12 } },
  { id: 'purple', en: 'Purple', jp: 'むらさき', price: 600, dot: '#9b6ad6', fx: { hue: 275, sat: 0.65 } },
  { id: 'gold', en: 'Gold', jp: 'きんいろ', price: 1500, dot: '#f2c230', fx: { hue: 45, sat: 0.95, light: 1.1 } },
  { id: 'shadow', en: 'Shadow', jp: 'かげ', price: 1500, dot: '#3b3552', fx: { hue: 260, sat: 0.3, light: 0.5 } },
  { id: 'ghost', en: 'Ghost', jp: 'おばけ', price: 2000, dot: '#e8f1ff', fx: { hue: 200, sat: 0.1, ghost: true } },
  { id: 'rainbow', en: 'Rainbow', jp: 'にじいろ', price: 3000, dot: 'linear-gradient(135deg,#e8514a,#f6d04d,#6cc36a,#4a78d6,#9b6ad6)', fx: { rainbow: true, sat: 0.85 } },
];
