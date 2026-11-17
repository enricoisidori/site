// node counting/build-assets.mjs
// Scrive 32 posizioni × {dorso, palmo} × {sinistra, destra} in counting/assets/
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handSVG, fingersFromValue } from './hands.js';

const root = join(dirname(fileURLToPath(import.meta.url)), 'assets');
const mapping = process.argv.includes('--thumb') ? 'thumb' : 'spatial';
const NAMES = { back: 'dorso', palm: 'palmo', left: 'sinistra', right: 'destra' };

for (const view of ['back', 'palm']) {
  for (const side of ['left', 'right']) {
    const dir = join(root, `${NAMES[view]}-${NAMES[side]}`);
    mkdirSync(dir, { recursive: true });
    for (let v = 0; v < 32; v++) {
      const bits = v.toString(2).padStart(5, '0');
      const svg = handSVG({
        fingers: fingersFromValue(v, side, mapping), side, view,
        title: `Counting — ${NAMES[view]} mano ${NAMES[side]} — ${v} (${bits})`,
      });
      writeFileSync(join(dir, `${String(v).padStart(2, '0')}_${bits}.svg`), svg);
    }
  }
}
console.log('ok:', root, 'mapping:', mapping);
