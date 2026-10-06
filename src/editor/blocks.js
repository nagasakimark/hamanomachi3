// The seven blocks. Wording must match the lesson exactly, so it lives here
// in one place (see blockLabel in engine.js for the running text).
const svg = (d, extra = '') => `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${d}</g>${extra}</svg>`;

export const BLOCK_DEFS = {
  start: {
    color: '#2fb35a', dark: '#1f8a41',
    icon: svg('', '<path d="M16 10 L38 24 L16 38 Z" fill="#fff"/>'),
  },
  straight: {
    color: '#ec3b3b', dark: '#b82424',
    icon: svg('<path d="M24 40 V10"/><path d="M13 20 L24 9 L35 20"/>'),
  },
  littlebit: {
    color: '#ff7676', dark: '#d54f55',
    icon: svg('<path d="M24 40 V26"/><path d="M15 32 L24 23 L33 32"/>', '<g fill="#fff"><circle cx="24" cy="12" r="3"/><circle cx="24" cy="4" r="0"/></g>'),
  },
  right: {
    color: '#2f6fe8', dark: '#1f4fb3',
    icon: svg('<path d="M14 40 V24 Q14 14 24 14 H36"/><path d="M29 7 L37 14 L29 21"/>'),
  },
  left: {
    color: '#e8337a', dark: '#b31d5a',
    icon: svg('<path d="M34 40 V24 Q34 14 24 14 H12"/><path d="M19 7 L11 14 L19 21"/>'),
  },
  lookLeft: {
    color: '#f5820d', dark: '#c0620a',
    icon: svg('<path d="M4 26 Q16 12 28 26 Q16 40 4 26 Z" stroke-width="4"/><path d="M44 26 H34"/><path d="M38 20 L32 26 L38 32" stroke-width="4"/>', '<circle cx="16" cy="26" r="4.5" fill="#fff"/>'),
  },
  lookRight: {
    color: '#8a3ffc', dark: '#6526c9',
    icon: svg('<path d="M44 26 Q32 12 20 26 Q32 40 44 26 Z" stroke-width="4"/><path d="M4 26 H14"/><path d="M10 20 L16 26 L10 32" stroke-width="4"/>', '<circle cx="32" cy="26" r="4.5" fill="#fff"/>'),
  },
};

// Palette order. Tap the number on a "go straight" block to change it.
export const PALETTE = [
  { type: 'straight', n: 1 },
  { type: 'littlebit' },
  { type: 'right' },
  { type: 'left' },
  { type: 'lookLeft' },
  { type: 'lookRight' },
];
