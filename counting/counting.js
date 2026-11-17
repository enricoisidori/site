// Counting by hands, 2026 — numeri, scatti, timeline. Tutto in BigInt (60 bit).

export const YEAR_S = 31557600; // anno giuliano (365,25 giorni), standard in astronomia
export const BITS = 60, PEOPLE = 6, HANDS = 12;

export const EPOCH_PRESET = `0 # Big Bang
3min # nucleosintesi
380000y # ricombinazione: fondo cosmico
200My # prime stelle
now-4.6Gy # nascita del Sole
now # oggi`;

export const DEFAULT_CFG = {
  video: 2,
  T: '435400207208642900',      // secondi dall'inizio dell'universo (13,797 miliardi di anni)
  v1dur: 60,
  segCount: 6, segDur: 5,
  mode: 'log',                   // log | person | carry | custom
  custom: EPOCH_PRESET,
  countInSeg: true,
  continuity: true,              // la persona 6 porta avanti la conta; le altre cambiano a ogni scatto
  inactive: 'show',              // show | dim | hide
  dimAlpha: 0.14,
  showAlpha: 0.32,              // persone non attive ma visibili: grigie
  mapping: 'spatial',            // spatial | thumb
  handView: 'back',             // back (dorso) | palm (palmo, il fronte delle mani)
  view: 'final',                 // final (flippato in post) | shot (come ripreso)
  showBin: true, showDec: true, showYears: true, showLabels: true, showTable: true,
  lang: 'en',
  bg: '#e1e1e1', handFill: '#ffffff', handStroke: '#111111', text: '#111111',
  width: 1920, height: 320, fps: 30,
  tweenMs: 140, tweenOnCut: true,
  metronome: true,
  framing: 'strip',              // strip (6:1) | cuts (video 3: 16:9, l'inquadratura si allarga a ogni cut)
  cutRes: '1920x1080', cutPad: 0.08, cutMove: 'cut', cutZoomMs: 600, cutOthers: false, cutFont: 0.03,
};

export const bitLength = (n) => (n > 0n ? n.toString(2).length : 0);
export const personsNeeded = (n) => Math.max(1, Math.ceil(bitLength(n) / 10));
export const toBin = (n) => n.toString(2).padStart(BITS, '0').slice(-BITS);
const MASK = (1n << BigInt(BITS)) - 1n;

// 12 valori 0..31, in ordine sullo schermo del video finale (0 = persona 1 mano sinistra, bit più alti)
export function handValues(n) {
  n &= MASK;
  const out = [];
  for (let h = 0; h < HANDS; h++) out.push(Number((n >> BigInt(55 - 5 * h)) & 31n));
  return out;
}

// --- parsing di tempi: "380000y", "3min", "1.2e13", "now", "now-4.6Gy", "2^40"
const UNITS = { s: 1, min: 60, h: 3600, d: 86400, y: YEAR_S, a: YEAR_S, ky: 1e3 * YEAR_S, my: 1e6 * YEAR_S, ma: 1e6 * YEAR_S, gy: 1e9 * YEAR_S, ga: 1e9 * YEAR_S };
function parseAmount(s) {
  s = s.trim().replace(',', '.');
  let m = s.match(/^2\^(\d+)$/);
  if (m) return 1n << BigInt(m[1]);
  m = s.match(/^([0-9.eE+-]+)\s*([a-zA-Z]*)$/);
  if (!m) throw new Error('tempo non valido: ' + s);
  const u = UNITS[m[2].toLowerCase() || 's'];
  if (u === undefined) throw new Error('unità sconosciuta: ' + m[2]);
  if (u === 1 && /^\d+$/.test(m[1])) return BigInt(m[1]);
  return BigInt(Math.round(parseFloat(m[1]) * u));
}
export function parseTime(s, T) {
  s = s.trim().toLowerCase().replace(/\s+/g, '');
  if (s === 'now' || s === 'oggi' || s === 't') return T;
  const m = s.match(/^(now|oggi|t)-(.+)$/);
  if (m) return T - parseAmount(m[2]);
  return parseAmount(s);
}

export function segmentStarts(cfg) {
  const T = BigInt(cfg.T);
  const S = cfg.segCount, D = cfg.segDur;
  if (cfg.mode === 'custom') {
    return cfg.custom.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).map((l) => {
      const [v, ...lab] = l.split('#');
      return { n: parseTime(v, T), label: lab.join('#').trim() };
    });
  }
  const out = [];
  for (let k = 0; k < S; k++) {
    let n;
    if (k === S - 1) n = T;
    else if (k === 0) n = 0n;
    else if (cfg.mode === 'log') n = BigInt(Math.round(Math.exp((Math.log(Number(T)) * k) / (S - 1))));
    else if (cfg.mode === 'person') n = 1n << BigInt(10 * k);
    else if (cfg.mode === 'carry') n = (1n << BigInt(10 * k)) - BigInt(Math.floor(D / 2));
    out.push({ n, label: '' });
  }
  return out;
}

export function buildTimeline(cfg) {
  const T = BigInt(cfg.T);
  if (cfg.video === 1) {
    // la persona 6 conta i secondi sulla mano destra partendo da 00000; la sua mano sinistra parte
    // da un valore con almeno due dita (vicino alle cifre di T, posizioni non difficili), poi riceve i riporti.
    // Lo scarto da T è < 1024 s, irrilevante su scala cosmica.
    const carries = Math.floor(cfg.v1dur / 32);
    const okL = (x) => x + carries <= 31 && [...Array(carries + 1)].every((_, j) => bits(x + j) >= 2 && difficulty(x + j, 10, cfg.mapping) === 0);
    const t5 = Number((T >> 5n) & 31n);
    let L5 = t5;
    for (let d = 0; d < 32 && !okL(L5); d++) { if (okL(t5 + d)) { L5 = t5 + d; break; } if (okL(t5 - d)) { L5 = t5 - d; break; } }
    // persone 1–5 tengono il numero di oggi: cifre di T, ma le posizioni difficili diventano la facile più vicina
    const hands = Array(HANDS).fill(0);
    hands[10] = L5;
    fitHands(T, hands, Math.floor(59 / 5 - Math.floor((bitLength(T) - 1) / 5)), 10, cfg.mapping);
    const n0 = handsToN(hands);
    const segs = [{ k: 0, t0: 0, t1: cfg.v1dur + 1, n0, target: T, label: '', counts: true }];
    return finish(segs, cfg);
  }
  const D = cfg.segDur;
  const segs = segmentStarts(cfg).map((s, k) => ({ k, t0: k * D, t1: (k + 1) * D, n0: s.n, target: s.n, label: s.label, counts: cfg.countInSeg }));
  // come nel video 1: l'ultimo scatto tiene un secondo in più (6 × 5 s + 1 = 31 s)
  if (segs.length) segs[segs.length - 1].t1 += 1;
  return finish(segs, cfg);
}
// Mani "credibili": nelle cifre che saltano a uno scatto, nessuna mano sotto la più alta resta a 00000
// (i momenti tondi tipo 2^30 o 1.024 darebbero file di zeri poco credibili e arbitrari).
// Si sceglie un valore con almeno due dita alzate; lo scarto resta sotto il peso della mano superiore.
const CREDIBLE = [3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28];
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function noRoundHands(n, keepBits, seed) {
  if (n <= 0n) return n;
  const top = Math.floor((bitLength(n) - 1) / 5);
  const r = rng(seed * 7919 + 17);
  for (let g = Math.ceil(keepBits / 5); g < top; g++) {
    if (((n >> BigInt(5 * g)) & 31n) === 0n) n += BigInt(CREDIBLE[Math.floor(r() * CREDIBLE.length)]) << BigInt(5 * g);
  }
  return n;
}

// Composizione degli scatti del video 2 (regole decise con Enrico):
//  - il primo scatto parte da 0;
//  - la persona 6 (bit 9–0) porta avanti la conta: a ogni scatto prosegue +1;
//  - tutte le altre mani attive CAMBIANO a ogni scatto (nessuna resta uguale);
//  - allo scatto nessuna posizione si ripete fra mani diverse;
//  - una persona attiva non ha mani a 00000;
//  - la persona più alta tiene le cifre del momento scelto (il tempo cosmico resta giusto);
//    le mani sotto di lei prendono valori nuovi (almeno due dita); all'ultimo scatto le cifre di T, dove possibile;
//  - "reach" = quante mani (dal basso) porta la conta: all'inizio solo la destra della persona 6.
//    La mano sopra (anche la sinistra della persona 6) cambia a ogni scatto come le altre finché
//    la conta non ci arriva con un riporto: da lì prosegue con la conta e basta.
// posizioni difficili: l'anulare diverso sia dal medio sia dal mignolo (alzato da solo tra i due,
// o abbassato da solo con medio e mignolo alzati). h pari = mano sinistra nel video finale.
export function fingersOf(v, h, mapping = 'spatial') {
  const b = (i) => (v >> i) & 1;
  return h % 2 === 1 || mapping === 'thumb' ? [b(0), b(1), b(2), b(3), b(4)] : [b(4), b(3), b(2), b(1), b(0)];
}
// difficoltà di una posizione (0 facile, 1 media, ≥2 difficile). Medio, anulare e mignolo sono legati:
//  - anulare diverso sia dal medio sia dal mignolo (su da solo, o giù da solo tra medio e mignolo su): 3
//  - medio giù con indice e anulare su: 2
//  - indice giù con medio su: 1;  anulare e mignolo su con medio giù: 1;  medio e anulare su con mignolo giù: 1
// Punteggi dati a mano da Enrico (difficulty.html): chiave = 'L' o 'R' + dita pollice→mignolo (1 = su),
// valore 0 facile, 1 media, 3 difficile. Hanno la precedenza sul modello qui sotto.
export const RATINGS_KEY = 'counting-ratings-v1';
// voti di Enrico, 2026-11-16 (34 posizioni; le altre usano il modello)
export const BAKED_RATINGS = {"L11101":1,"R11101":1,"R11011":1,"L11011":1,"R10111":0,"L10111":0,"R10110":1,"L10110":1,"R10101":1,"R10011":1,"L10101":1,"R01101":0,"L01101":0,"L01110":0,"R01110":0,"R01011":0,"L01011":0,"R00111":0,"L00111":0,"R11000":0,"L11000":0,"R10100":0,"L10100":0,"R00110":0,"L00110":0,"R11110":0,"L11110":1,"R00011":0,"L00011":0,"L01001":0,"R00100":0,"L00100":0,"R00010":1,"L00010":1};
let RATINGS = { ...BAKED_RATINGS };
try { Object.assign(RATINGS, JSON.parse(globalThis.localStorage?.getItem(RATINGS_KEY) || '{}')); } catch {}
export function setRatings(obj) { RATINGS = { ...BAKED_RATINGS, ...obj }; }
export const ratingKey = (v, h, mapping) => (h % 2 === 1 ? 'R' : 'L') + fingersOf(v, h, mapping).join('');
export function modelDifficulty(v, h, mapping) {
  const [, i, m, r, p] = fingersOf(v, h, mapping);
  let d = 0;
  if (r !== m && r !== p) d += 3;
  if (m === 0 && i === 1 && r === 1) d += 2;
  if (i === 0 && m === 1) d += 1;
  if (r === 1 && p === 1 && m === 0) d += 1;
  if (m === 1 && r === 1 && p === 0) d += 1;
  return d;
}
export function difficulty(v, h, mapping) {
  const k = ratingKey(v, h, mapping);
  return k in RATINGS ? RATINGS[k] : modelDifficulty(v, h, mapping);
}
export function isHard(v, h, mapping) { return difficulty(v, h, mapping) >= 2; }
const bits = (v) => (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1) + ((v >> 3) & 1) + ((v >> 4) & 1);
// La posizione da usare al posto di pref: prima le facili, poi le medie, mai le difficili se evitabile.
// near = la cifra conta per il numero (mano più alta, ultimo scatto, video 1): resta entro ±3 se può.
function pickHand(pref, prev, used, minBits = 1, h = 0, mapping = 'spatial', near = false) {
  const nearest = (lvl, maxD = 31) => {
    for (let d = 0; d <= maxD; d++) {
      for (const c of d ? [pref + d, pref - d] : [pref]) {
        if (c >= 1 && c <= 31 && bits(c) >= minBits && c !== prev && !used.has(c) && difficulty(c, h, mapping) <= lvl) return c;
      }
    }
    return null;
  };
  // solo posizioni facili: le medie solo se non esiste nessuna facile possibile
  return (near ? nearest(0, 3) : null) ?? nearest(0) ?? nearest(1) ?? nearest(9) ?? pref;
}
const handsToN = (hands) => hands.reduce((n, v, h) => n | (BigInt(v) << BigInt(55 - 5 * h)), 0n);
// Mani from..to-1 dall'alto: ognuna prende la posizione più facile e più simile alla cifra del target
// fra quelle con cui le mani sotto possono ancora riportare il totale entro tol dal target
// (tol ≈ target/30000: l'età resta la stessa alla terza cifra, es. 13,797 miliardi di anni).
// opts: prev (posizioni da cambiare), used (posizioni già prese), minBits(h).
function fitHands(target, hands, from, to, mapping, opts = {}) {
  const tv = handValues(target), tol = target / 30000n;
  const W = (h) => 1n << BigInt(55 - 5 * h);
  const used = opts.used || new Set();
  for (let h = from; h < to; h++) {
    let lo = 0n, hi = 0n;
    for (let j = h + 1; j < to; j++) { lo += W(j); hi += 31n * W(j); }
    for (let j = to; j < HANDS; j++) { hi += BigInt(hands[j]) * W(j); lo += BigInt(hands[j]) * W(j); }
    let fixedAbove = 0n;
    for (let j = 0; j < h; j++) fixedAbove += BigInt(hands[j]) * W(j);
    const rest = target - fixedAbove;
    const cands = [];
    for (let c = 1; c < 32; c++) {
      if (bits(c) < (opts.minBits ? opts.minBits(h) : 1) || used.has(c) || (opts.prev && opts.prev[h] === c)) continue;
      const err = rest - BigInt(c) * W(h);
      const miss = err < lo ? lo - err : err > hi ? err - hi : 0n;
      cands.push({ c, miss, d: Math.min(difficulty(c, h, mapping), 3), dist: Math.abs(c - tv[h]) });
    }
    // prima le facili che tengono il numero entro tol; poi le facili più vicine; solo dopo le medie
    const easy = cands.filter((x) => x.d === 0), okEasy = easy.filter((x) => x.miss <= tol);
    const ok = cands.filter((x) => x.miss <= tol);
    let pool;
    if (okEasy.length) pool = okEasy.sort((a, b) => a.dist - b.dist);
    else if (easy.length) pool = easy.sort((a, b) => Number(a.miss - b.miss) || a.dist - b.dist);
    else pool = (ok.length ? ok : cands).sort((a, b) => a.d - b.d || Number(a.miss - b.miss));
    hands[h] = pool[0].c;
    used.add(pool[0].c);
  }
  return hands;
}
function composeCut(k, s, prev, isLast, nextTarget, T, custom, mapping) {
  const tv = handValues(s.target);
  const prevHands = prev ? handValues(prev.n0) : Array(HANDS).fill(0);
  const hands = Array(HANDS).fill(0);
  let reach = prev ? prev.reach : 1;
  if (prev) {
    // la conta prosegue: se nel frattempo un riporto è entrato nella mano sopra, ora la porta anche lei
    const cont = handValues(prev.nLast + 1n);
    while (reach < HANDS && cont[HANDS - 1 - reach] !== prevHands[HANDS - 1 - reach]) reach++;
    for (let h = HANDS - reach; h < HANDS; h++) hands[h] = cont[h];
  }
  s.reach = reach;
  const A = Math.max(personsNeeded(s.target), prev ? prev.active : 1);
  const firstH = HANDS - 2 * A;
  const used = new Set(hands.slice(HANDS - reach).filter((v) => v));
  const r = rng(k * 977 + 13);
  if (!prev) return 0n; // primo scatto: 0
  if (isLast) {
    // ultimo scatto: il numero di oggi (età di T alla terza cifra), con posizioni facili, tutte nuove e diverse
    fitHands(T, hands, firstH, HANDS - reach, mapping, { prev: prevHands, used, minBits: (h) => (h < firstH + 2 ? 1 : 2) });
    return handsToN(hands);
  }
  for (let h = firstH; h < HANDS - reach; h++) {
    const topPerson = h < firstH + 2;
    let pref;
    // nelle liste di epoche la mano più alta resta quella vera (anche 00000) per non spostare il momento
    if (topPerson) {
      pref = h === firstH ? (custom ? tv[h] : Math.max(tv[h], 1)) : tv[h] || 1 + Math.floor(r() * 31);
      if (pref === 0) { hands[h] = 0; continue; }
    } else pref = isLast && bits(tv[h]) >= 2 ? tv[h] : CREDIBLE[Math.floor(r() * CREDIBLE.length)];
    const near = topPerson || isLast; // cifre che contano per il numero: vicine a quelle vere
    hands[h] = pickHand(pref, prevHands[h], used, h === firstH || (isLast && topPerson) ? 1 : 2, h, mapping, near);
    used.add(hands[h]);
  }
  let n = 0n;
  hands.forEach((v, h) => (n |= BigInt(v) << BigInt(55 - 5 * h)));
  return n;
}

function finish(segs, cfg) {
  const T = BigInt(cfg.T);
  const compose = cfg.video !== 1 && cfg.continuity !== false && cfg.countInSeg && cfg.mode !== 'carry';
  segs.forEach((s, k) => {
    s.contBits = 0;
    if (compose) {
      const prev = k > 0 ? segs[k - 1] : null;
      const nextTarget = k + 1 < segs.length ? segs[k + 1].target : T;
      s.n0 = composeCut(k, s, prev, k === segs.length - 1, nextTarget, T, cfg.mode === 'custom', cfg.mapping);
      if (prev) s.contBits = 5 * s.reach;
    }
    s.nLast = s.n0 + BigInt(s.counts ? Math.max(0, Math.ceil(s.t1 - s.t0) - 1) : 0);
    s.active = personsNeeded(s.nLast);
    if (compose) s.active = Math.max(s.active, personsNeeded(s.target), k > 0 ? segs[k - 1].active : 1);
  });
  return { segs, duration: segs.length ? segs[segs.length - 1].t1 : 0 };
}

export function stateAt(tl, t) {
  const segs = tl.segs;
  let k = segs.findIndex((s) => t >= s.t0 && t < s.t1);
  if (k < 0) k = t < 0 ? 0 : segs.length - 1;
  const s = segs[k];
  const local = Math.min(Math.max(t - s.t0, 0), s.t1 - s.t0 - 1e-6);
  const step = s.counts ? Math.floor(local) : 0;
  const n = s.n0 + BigInt(step);
  let prevN = n, cut = false;
  if (step > 0) prevN = n - 1n;
  else if (k > 0) { prevN = segs[k - 1].nLast; cut = true; }
  return { k, seg: s, n, prevN, since: local - step, cut, local };
}

// --- formattazione
export const groupInt = (str, sep = '.') => str.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
export const fmtDec = (n) => groupInt(n.toString());

export function fmtYears(n, lang = 'it') {
  const word = lang === 'en' ? 'years' : 'anni';
  if (n === 0n) return `0 ${word}`;
  const Y = BigInt(YEAR_S);
  const y = Number(n) / YEAR_S;
  let s;
  if (y >= 1000) s = groupInt((n / Y).toString());
  else if (y >= 1) {
    const [i, f] = y.toFixed(2).split('.');
    s = groupInt(i) + (f !== '00' ? ',' + f.replace(/0+$/, '') : '');
  } else {
    s = y.toLocaleString('en-US', { maximumSignificantDigits: 3, useGrouping: false }).replace('.', ',');
  }
  if (lang === 'en') s = s.replace(/\./g, ' ').replace(',', '.').replace(/ /g, ',');
  return `${s} ${s === '1' ? (lang === 'en' ? 'year' : 'anno') : word}`;
}

// durata leggibile (per le tabelle): 3,2 giorni, 1.080 anni, ecc.  lang 'en' per i fogli
export function fmtHuman(n, lang = 'it') {
  const x = Number(n), en = lang === 'en';
  const f = (v, d = 1) => (en ? v.toFixed(d) : v.toFixed(d).replace('.', ','));
  const W = en ? ['hours', 'days', 'years', 'thousand years', 'million years', 'billion years']
    : ['ore', 'giorni', 'anni', 'mila anni', 'milioni di anni', 'miliardi di anni'];
  if (x < 60) return `${x} s`;
  if (x < 3600) return `${f(x / 60)} min`;
  if (x < 86400) return `${f(x / 3600)} ${W[0]}`;
  if (x < YEAR_S) return `${f(x / 86400)} ${W[1]}`;
  const y = x / YEAR_S;
  if (y < 1e3) return `${f(y)} ${W[2]}`;
  if (y < 1e6) return `${f(y / 1e3)} ${W[3]}`;
  if (y < 1e9) return `${f(y / 1e6)} ${W[4]}`;
  return `${f(y / 1e9, 3)} ${W[5]}`;
}

export const fmtClock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// configurazione condivisa fra animatic e fogli (localStorage + ?cfg=)
const KEY = 'counting-cfg-v6'; // cambiato: i nuovi predefiniti sostituiscono quelli salvati
export function loadCfg() {
  let cfg = { ...DEFAULT_CFG };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
  try {
    const q = new URLSearchParams(location.search).get('cfg');
    if (q) Object.assign(cfg, JSON.parse(decodeURIComponent(escape(atob(q)))));
  } catch {}
  return cfg;
}
export function saveCfg(cfg) { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} }
export const cfgParam = (cfg) => btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
