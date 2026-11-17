// Counting by hands, 2026 — generatore vettoriale delle mani.
// Una sola geometria: mano DESTRA vista dal DORSO (pollice a sinistra di chi guarda).
// Le altre tre viste si ottengono specchiando:
//   dorso destra  -> nessuno specchio      (pollice a sinistra)
//   dorso sinistra-> specchio              (pollice a destra)
//   palmo destra  -> specchio              (pollice a destra: la tua destra, palmo verso di te)
//   palmo sinistra-> nessuno specchio      (pollice a sinistra)
// Dita: [pollice, indice, medio, anulare, mignolo], valore 0..1 (1 = alzato).

export const VIEW_W = 228;           // larghezza utile (x da -14 a 214), simmetrica attorno a x=100
export const VIEW_X0 = -14;
export const VIEW_Y0 = 8;
export const VIEW_H = 262;           // fino a y=270 (il polso viene tagliato lì)

const FINGERS = [
  { bx: 67,  by: 128, a: -7,   len: 96,  w: 23, fold: 50 }, // indice
  { bx: 91,  by: 126, a: -1.5, len: 106, w: 24, fold: 54 }, // medio
  { bx: 114, by: 128, a: 4,    len: 98,  w: 23, fold: 50 }, // anulare
  { bx: 136, by: 140, a: 11,   len: 78,  w: 20, fold: 40 }, // mignolo
];
const THUMB = { bx: 60, by: 196, w: 27, up: { a: -44, len: 76 }, down: { a: -8, len: 44 } };
const PALM = 'M54 134Q55 118 72 116L126 116Q146 120 148 142C151 172 148 202 137 226L137 320L63 320L63 226C54 206 50 184 50 160Z';

// Posizioni orizzontali (geometria non specchiata) delle 5 cifre binarie sotto la mano,
// da sinistra a destra = pollice, indice, medio, anulare, mignolo.
export const DIGIT_X = [38, 64, 90, 116, 142];

const r2 = (v) => Math.round(v * 100) / 100;
const P = (x, y) => `${r2(x)} ${r2(y)}`;

function dir(aDeg) {
  const a = (aDeg * Math.PI) / 180;
  return { ux: Math.sin(a), uy: -Math.cos(a), nx: Math.cos(a), ny: Math.sin(a) };
}

// dito: base piatta (nascosta nel palmo), punta arrotondata, leggera rastrematura
function capsule(bx, by, aDeg, len, w, taper = 0.88) {
  const { ux, uy, nx, ny } = dir(aDeg);
  const wt = w * taper, r = wt / 2;
  const L = Math.max(len - r, 0.5);
  const tx = bx + ux * L, ty = by + uy * L;
  return `M${P(bx - nx * w / 2, by - ny * w / 2)}L${P(tx - nx * r, ty - ny * r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${P(tx + nx * r, ty + ny * r)}L${P(bx + nx * w / 2, by + ny * w / 2)}Z`;
}

// forma a "stadio" (entrambe le estremità arrotondate): unghie, dita piegate sul palmo
function stadium(cx, cy, aDeg, len, w) {
  const { ux, uy, nx, ny } = dir(aDeg);
  const r = w / 2, h = Math.max(len / 2 - r, 0.01);
  const ax = cx - ux * h, ay = cy - uy * h, bx = cx + ux * h, by = cy + uy * h;
  return `M${P(ax - nx * r, ay - ny * r)}L${P(bx - nx * r, by - ny * r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${P(bx + nx * r, by + ny * r)}L${P(ax + nx * r, ay + ny * r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${P(ax - nx * r, ay - ny * r)}Z`;
}

// piega trasversale su un dito (alla frazione f della lunghezza)
function crease(bx, by, aDeg, len, w, f, k = 0.26, bow = 1.6) {
  const { ux, uy, nx, ny } = dir(aDeg);
  const cx = bx + ux * len * f, cy = by + uy * len * f;
  const x1 = cx - nx * w * k, y1 = cy - ny * w * k, x2 = cx + nx * w * k, y2 = cy + ny * w * k;
  return `M${P(x1, y1)}Q${P(cx + ux * bow, cy + uy * bow)} ${P(x2, y2)}`;
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Restituisce la mano come insieme di tracciati (coordinate NON specchiate).
 *  sil:    tracciati della sagoma (unione: si disegna contorno spesso e poi riempimento)
 *  lines:  dettagli a solo contorno (unghie, pieghe)
 *  light:  dettagli tenui (tendini, linee del palmo)
 *  over:   forme sovrapposte (dita piegate sul palmo, pollice piegato), ognuna con i suoi dettagli
 */
export function handModel(ext, view = 'back') {
  const sil = [PALM], lines = [], light = [], over = [];
  const palmView = view === 'palm';

  // pollice
  const te = ext[0];
  if (palmView && te < 0.5) {
    // pollice piegato attraverso il palmo (sopra le dita piegate): aggiunto alla fine
  } else {
    const a = lerp(THUMB.down.a, THUMB.up.a, te), len = lerp(THUMB.down.len, THUMB.up.len, te);
    sil.push(capsule(THUMB.bx, THUMB.by, a, len, THUMB.w, 0.86));
    if (te > 0.6) {
      if (palmView) lines.push(crease(THUMB.bx, THUMB.by, a, len, THUMB.w, 0.62, 0.24));
      else {
        const { ux, uy } = dir(a);
        const d = len - THUMB.w * 0.5;
        lines.push(stadium(THUMB.bx + ux * d, THUMB.by + uy * d, a, THUMB.w * 0.62, THUMB.w * 0.44));
        light.push(crease(THUMB.bx, THUMB.by, a, len, THUMB.w, 0.5, 0.2));
      }
    }
  }

  // dita
  FINGERS.forEach((F, i) => {
    const e = ext[i + 1];
    const stub = F.w * 0.95;
    if (palmView && e < 0.5) {
      // dito piegato visto dal palmo: nocca in sagoma + falangi ripiegate sopra il palmo
      sil.push(capsule(F.bx, F.by, F.a, stub + 6, F.w, 0.95));
      const ang = 180 + F.a * 0.4, L = F.fold;
      const { ux, uy } = dir(ang);
      const cx = F.bx + ux * (L / 2 - 6), cy = F.by - 10 + uy * (L / 2 - 6);
      const tipx = cx + ux * (L / 2 - F.w * 0.5), tipy = cy + uy * (L / 2 - F.w * 0.5);
      over.push({
        d: stadium(cx, cy, ang, L, F.w * 0.98),
        lines: [stadium(tipx - ux * 1.5, tipy - uy * 1.5, ang, F.w * 0.55, F.w * 0.5)],
      });
      return;
    }
    const len = lerp(stub, F.len, e);
    sil.push(capsule(F.bx, F.by, F.a, len, F.w));
    if (e > 0.6) {
      if (palmView) {
        lines.push(crease(F.bx, F.by, F.a, len, F.w, 0.36));
        lines.push(crease(F.bx, F.by, F.a, len, F.w, 0.64));
      } else {
        const { ux, uy } = dir(F.a);
        const d = len - F.w * 0.48;
        lines.push(stadium(F.bx + ux * d, F.by + uy * d, F.a, F.w * 0.6, F.w * 0.5));
        light.push(crease(F.bx, F.by, F.a, len, F.w, 0.56, 0.22, -1.4));
        light.push(crease(F.bx, F.by, F.a, len, F.w, 0.59, 0.16, -1.4));
      }
    } else if (!palmView && e < 0.35) {
      // nocca: piccola piega sul dito ripiegato visto dal dorso
      light.push(crease(F.bx, F.by, F.a, len, F.w, 0.62, 0.2, 1.2));
    }
  });

  if (palmView) {
    // linee del palmo (cuore, testa, vita)
    light.push('M146 152Q116 145 82 134');
    light.push('M57 160Q96 165 134 182');
    light.push('M62 148Q93 184 86 230');
    if (te < 0.5) {
      const a = 62, L = 76;
      const { ux, uy } = dir(a);
      const cx = THUMB.bx + ux * (L / 2 - 8), cy = THUMB.by + uy * (L / 2 - 8);
      const tipx = cx + ux * (L / 2 - THUMB.w * 0.5), tipy = cy + uy * (L / 2 - THUMB.w * 0.5);
      over.push({
        d: stadium(cx, cy, a, L, THUMB.w * 0.94),
        lines: [stadium(tipx - ux * 2, tipy - uy * 2, a, THUMB.w * 0.6, THUMB.w * 0.46)],
      });
    }
  } else {
    // tendini sul dorso
    FINGERS.forEach((F) => light.push(`M${P(F.bx, 146)}Q${P(F.bx + (100 - F.bx) * 0.15, 190)} ${P(100 + (F.bx - 100) * 0.4, 236)}`));
  }
  return { sil, lines, light, over };
}

// side: 'left' | 'right' (anatomica), view: 'back' | 'palm'
export function mirrorFor(side, view) {
  return (side === 'left') !== (view === 'palm');
}

// Valore 0..31 -> stato delle dita [pollice, indice, medio, anulare, mignolo].
// mapping 'spatial': le cifre si leggono da sinistra a destra nel video finale
//   (mano destra: pollice = 1 ... mignolo = 16; mano sinistra: mignolo = 1 ... pollice = 16)
// mapping 'thumb': su entrambe le mani pollice = 1 ... mignolo = 16
export function fingersFromValue(v, side, mapping = 'spatial') {
  const b = (i) => (v >> i) & 1;
  if (side === 'right' || mapping === 'thumb') return [b(0), b(1), b(2), b(3), b(4)];
  return [b(4), b(3), b(2), b(1), b(0)];
}

export const DEFAULT_STYLE = { fill: '#ffffff', stroke: '#111111', sw: 2.2, light: 0.45 };

/** SVG autonomo di una mano */
export function handSVG({ fingers, side = 'right', view = 'back', style = {}, width, height, title } = {}) {
  const st = { ...DEFAULT_STYLE, ...style };
  const m = handModel(fingers, view);
  const mirror = mirrorFor(side, view);
  const tf = mirror ? ' transform="translate(200 0) scale(-1 1)"' : '';
  const sw = st.sw;
  const silStroke = m.sil.map((d) => `<path d="${d}"/>`).join('');
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_X0} ${VIEW_Y0} ${VIEW_W} ${VIEW_H}"` +
    (width ? ` width="${width}"` : '') + (height ? ` height="${height}"` : '') + '>');
  if (title) out.push(`<title>${title}</title>`);
  out.push(`<defs><clipPath id="c"><rect x="${VIEW_X0}" y="${VIEW_Y0}" width="${VIEW_W}" height="${VIEW_H}"/></clipPath></defs>`);
  out.push(`<g clip-path="url(#c)"><g${tf} stroke-linejoin="round" stroke-linecap="round">`);
  out.push(`<g fill="none" stroke="${st.stroke}" stroke-width="${sw * 2}">${silStroke}</g>`);
  out.push(`<g fill="${st.fill}" stroke="none">${silStroke}</g>`);
  out.push(`<g fill="none" stroke="${st.stroke}" stroke-width="${sw * 0.7}" opacity="${st.light}">${m.light.map((d) => `<path d="${d}"/>`).join('')}</g>`);
  out.push(`<g fill="none" stroke="${st.stroke}" stroke-width="${sw * 0.75}">${m.lines.map((d) => `<path d="${d}"/>`).join('')}</g>`);
  for (const o of m.over) {
    out.push(`<path d="${o.d}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${sw}"/>`);
    out.push(`<g fill="none" stroke="${st.stroke}" stroke-width="${sw * 0.75}">${o.lines.map((d) => `<path d="${d}"/>`).join('')}</g>`);
  }
  out.push('</g></g></svg>');
  return out.join('');
}

/** Disegna una mano su canvas. (ox, oy) = punto geometrico (0,0); s = scala */
export function drawHand(ctx, { ext, view = 'back', mirror = false, ox, oy, s, style = {}, alpha = 1, cache }) {
  const st = { ...DEFAULT_STYLE, ...style };
  const m = handModel(ext, view);
  const path = (d) => {
    if (!cache) return new Path2D(d);
    let p = cache.get(d);
    if (!p) { p = new Path2D(d); cache.set(d, p); }
    return p;
  };
  ctx.save();
  ctx.globalAlpha = alpha;
  if (mirror) { ctx.translate(ox + 200 * s, oy); ctx.scale(-s, s); } else { ctx.translate(ox, oy); ctx.scale(s, s); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const sil = m.sil.map(path);
  ctx.strokeStyle = st.stroke; ctx.lineWidth = st.sw * 2;
  sil.forEach((p) => ctx.stroke(p));
  ctx.fillStyle = st.fill;
  sil.forEach((p) => ctx.fill(p));
  ctx.globalAlpha = alpha * st.light; ctx.lineWidth = st.sw * 0.7;
  m.light.forEach((d) => ctx.stroke(path(d)));
  ctx.globalAlpha = alpha; ctx.lineWidth = st.sw * 0.75;
  m.lines.forEach((d) => ctx.stroke(path(d)));
  for (const o of m.over) {
    const p = path(o.d);
    ctx.fill(p); ctx.lineWidth = st.sw; ctx.stroke(p);
    ctx.lineWidth = st.sw * 0.75; o.lines.forEach((d) => ctx.stroke(path(d)));
  }
  ctx.restore();
}
