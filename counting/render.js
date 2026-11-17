// Counting by hands, 2026 — disegno di un fotogramma (anteprima ed export usano la stessa funzione)
import { drawHand, fingersFromValue, DIGIT_X } from './hands.js';
import { handValues, toBin, fmtDec, fmtYears, fmtHuman, fmtClock, stateAt, PEOPLE, groupInt } from './counting.js';

const cache = new Map();
export const FONT = '"Neue Haas Grotesk Text Pro", "NHaasGroteskTXPro-55Rg", "Neue Haas Grotesk Display Pro", "Helvetica Neue", Helvetica, Arial, sans-serif';

// H = altezza della fascia mani + testo (cfg.height); la tabella del video 2 si aggiunge sotto.
export function layout(W, H, rows = 0) {
  const padX = Math.round(W * 0.02);
  const handsTop = H * 0.05, handsBottom = H * 0.655;
  const Pw = (W - 2 * padX) / PEOPLE, Hw = Pw / 2;
  const s = Math.min((Hw * 0.9) / 228, (handsBottom - handsTop) / 250);
  const fDec = H * 0.046, lineH = fDec * 1.5;
  const yDec = H * 0.862, yYears = yDec + lineH;           // seconds e years su righe consecutive
  const yTable = yYears + lineH * 2;                        // tabella: una riga vuota sotto years
  const bottom = rows ? yTable + (rows - 1) * lineH + H * 0.07 : H;
  return { padX, handsTop, handsBottom, Pw, Hw, s, lineH, yTable, bottom,
    yBin: H * 0.755, yDec, yYears,
    fBin: H * 0.048, fDec, fYears: fDec, fLabel: H * 0.036 };
}

// la tabella degli scatti compare solo nel video con più scatti
export const tableRows = (cfg, tl) => (cfg.showTable !== false && tl.segs.length > 1 ? tl.segs.length : 0);
// dimensioni reali del fotogramma (altezza pari per H.264)
export function frameSize(cfg, tl) {
  if (cfg.framing === 'cuts') return (cfg.cutRes || '1920x1080').split('x').map(Number);
  const rows = tableRows(cfg, tl);
  if (!rows) return [cfg.width, cfg.height];
  return [cfg.width, 2 * Math.ceil(layout(cfg.width, cfg.height, rows).bottom / 2)];
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function sci(n) {
  if (n === 0n) return '0';
  const s = n.toString(), e = s.length - 1;
  if (e < 3) return s + ' s';
  return `${s[0]}.${s.slice(1, 3)} × 10${String(e).split('').map((d) => SUP[d]).join('')} s`;
}
function tableCells(seg) {
  const n = seg.n0;
  return [`${fmtClock(seg.t0)}–${fmtClock(seg.t1)}`, groupInt(n.toString(), ',') + ' s',
    n === 0n ? '0 years' : fmtHuman(n, 'en'), sci(n)];
}

const ease = (k) => 1 - Math.pow(1 - k, 3);
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(c, bg, a) {
  const x = hex(c), y = hex(bg);
  return '#' + x.map((v, i) => Math.round(y[i] + (v - y[i]) * a).toString(16).padStart(2, '0')).join('');
}

export function renderFrame(ctx, cfg, tl, t) {
  return cfg.framing === 'cuts' ? renderCuts(ctx, cfg, tl, t) : renderStrip(ctx, cfg, tl, t);
}

// stato comune: transizioni e trasparenza delle persone
function frameState(cfg, tl, t, offAlpha) {
  const st = stateAt(tl, t);
  const seg = st.seg;
  const prevSeg = st.k > 0 ? tl.segs[st.k - 1] : null;
  const kTween = ease(cfg.tweenMs > 0 ? Math.min(1, (st.since * 1000) / cfg.tweenMs) : 1);
  // allo scatto: le mani che proseguono il conteggio fanno il normale +1 animato, le altre saltano
  const kFor = (h) => (!st.cut || cfg.tweenOnCut || 60 - 5 * h <= (seg.contBits || 0) ? kTween : 1);
  // persone non ancora attive: grigie (show), quasi invisibili (dim) o assenti (hide).
  // Quando una persona si attiva passa a pieno contrasto con la stessa transizione delle dita.
  const personAlpha = (p) => {
    const active = p >= PEOPLE - seg.active;
    if (!active) return offAlpha;
    const wasActive = !prevSeg || p >= PEOPLE - prevSeg.active;
    return st.cut && !wasActive ? offAlpha + (1 - offAlpha) * kTween : 1;
  };
  return { st, seg, kTween, kFor, personAlpha, cur: handValues(st.n), prev: handValues(st.prevN) };
}

// mani + cifre binarie, nelle coordinate della striscia (W × L)
function drawStrip(ctx, cfg, F, L, W) {
  const shot = cfg.view === 'shot';
  const X = (x) => (shot ? W - x : x); // posizione orizzontale (vista "come ripresa" = specchiata)
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, L.handsBottom); ctx.clip();
  if (shot) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  const style = { fill: cfg.handFill, stroke: cfg.handStroke, sw: 2.2 };
  for (let h = 0; h < 12; h++) {
    const p = Math.floor(h / 2), a = F.personAlpha(p);
    if (a <= 0) continue;
    const leftOnScreen = h % 2 === 0;           // nel video finale: mano sinistra del modello
    const side = leftOnScreen ? 'left' : 'right';
    const fa = fingersFromValue(F.prev[h], side, cfg.mapping);
    const fb = fingersFromValue(F.cur[h], side, cfg.mapping);
    const k = F.kFor(h);
    const ext = fb.map((b, i) => fa[i] + (b - fa[i]) * k);
    const cx = L.padX + p * L.Pw + (leftOnScreen ? 0.5 : 1.5) * L.Hw;
    // attenuazione per mescola di colori (con l'alpha si vedrebbero i contorni interni sovrapposti)
    const hs = a >= 1 ? style : { ...style, fill: mix(cfg.handFill, cfg.bg, a), stroke: mix(cfg.handStroke, cfg.bg, a) };
    drawHand(ctx, { ext, view: cfg.handView === 'palm' ? 'palm' : 'back', mirror: !leftOnScreen, ox: cx - 100 * L.s, oy: L.handsTop - 8 * L.s, s: L.s, style: hs, cache });
  }
  ctx.restore();
  if (cfg.showBin) {
    const bin = toBin(F.st.n);
    // ogni mano: le sue 5 cifre, spaziatura normale, centrate sotto la mano
    ctx.fillStyle = cfg.text; ctx.textBaseline = 'alphabetic';
    ctx.font = `400 ${L.fBin}px ${FONT}`; ctx.textAlign = 'center';
    for (let h = 0; h < 12; h++) {
      const p = Math.floor(h / 2), a = F.personAlpha(p);
      if (a <= 0 && F.onlyActive) continue;
      const cx = L.padX + p * L.Pw + (h % 2 === 0 ? 0.5 : 1.5) * L.Hw;
      ctx.globalAlpha = Math.max(a, cfg.dimAlpha);
      ctx.fillText(bin.slice(h * 5, h * 5 + 5), X(cx), L.yBin);
    }
    ctx.globalAlpha = 1;
  }
}

// seconds, years, tabella (T: posizioni nel fotogramma in uscita)
function drawText(ctx, cfg, tl, F, T) {
  const { st, seg } = F;
  ctx.fillStyle = cfg.text; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  if (cfg.showDec) {
    const en = cfg.lang === 'en';
    const s = en ? groupInt(st.n.toString(), ',') : fmtDec(st.n);
    const unit = ' ' + (st.n === 1n ? (en ? 'second' : 'secondo') : (en ? 'seconds' : 'secondi'));
    ctx.font = `400 ${T.f}px ${FONT}`;
    ctx.fillText(s + unit, T.cx, T.yDec);
  }
  if (cfg.showYears) {
    ctx.font = `400 ${T.f}px ${FONT}`;
    ctx.fillText(fmtYears(st.n, cfg.lang), T.cx, T.yYears);
  }
  if (T.rows) {
    // tabella: tempo nel video, secondi, tempo cosmico, potenza. Grigia; lo scatto in corso è nero.
    const off = cfg.showAlpha, colW = (T.x1 - T.x0) / 4;
    ctx.font = `400 ${T.f}px ${FONT}`; ctx.textAlign = 'left';
    tl.segs.forEach((sg, k) => {
      let a = off;
      if (k === st.k) a = st.cut ? off + (1 - off) * F.kTween : 1;
      else if (st.cut && k === st.k - 1) a = 1 - (1 - off) * F.kTween;
      ctx.fillStyle = mix(cfg.text, cfg.bg, a);
      tableCells(sg).forEach((c, i) => ctx.fillText(c, T.x0 + i * colW, T.yTable + k * T.lineH));
    });
    ctx.fillStyle = cfg.text;
  }
  if (cfg.showLabels && seg.label) {
    ctx.font = `400 ${T.fLabel}px ${FONT}`; ctx.textAlign = 'left'; ctx.globalAlpha = 0.75;
    ctx.fillText(seg.label, T.x0, T.yYears);
    ctx.globalAlpha = 1;
  }
}

// --- video 2 come striscia 6:1 (la tabella si aggiunge sotto)
function renderStrip(ctx, cfg, tl, t) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const rows = tableRows(cfg, tl);
  const L = layout(W, cfg.height * (W / cfg.width), rows);
  const offAlpha = cfg.inactive === 'hide' ? 0 : cfg.inactive === 'dim' ? cfg.dimAlpha : cfg.showAlpha;
  const F = frameState(cfg, tl, t, offAlpha);
  ctx.save();
  ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
  drawStrip(ctx, cfg, F, L, W);
  drawText(ctx, cfg, tl, F, { f: L.fDec, fLabel: L.fLabel, cx: W / 2, yDec: L.yDec, yYears: L.yYears,
    yTable: L.yTable, lineH: L.lineH, rows, x0: L.padX, x1: W - L.padX });
  ctx.restore();
  return F.st;
}

// --- video 3: inquadrature 16:9, a ogni cut si allarga (2 mani, 4, 6 … 12)
// La striscia è disegnata in vettoriale con una trasformazione: niente perdita di qualità.
export const CUT_DEFAULTS = { cutRes: '1920x1080', cutPad: 0.08, cutMove: 'cut', cutZoomMs: 600, cutOthers: false, cutFont: 0.03 };
function cutGeometry(cfg, tl, W, H) {
  const c = { ...CUT_DEFAULTS, ...cfg };
  const rows = tableRows(cfg, tl);
  const f = H * c.cutFont, lineH = f * 1.5, margin = H * 0.06;
  const lines = (cfg.showDec ? 1 : 0) + (cfg.showYears ? 1 : 0);
  // blocco di testo in basso: seconds, years, (riga vuota), tabella
  const textH = (lines ? lines * lineH : 0) + (rows ? (lines ? lineH : 0) + rows * lineH : 0);
  const textTop = H - margin - textH + f;               // linea di base della prima riga
  const handsBox = { x: 0, y: margin * 0.5, w: W, h: (textH ? textTop - f - lineH * 0.6 : H - margin * 0.5) - margin * 0.5 };
  return { c, rows, f, lineH, textTop, handsBox };
}
// riquadro (in coordinate della striscia) che contiene le m persone attive
function cropFor(m, L, W0, shot) {
  const x0 = m >= PEOPLE ? 0 : L.padX + (PEOPLE - m) * L.Pw;
  const x1 = W0 - (m >= PEOPLE ? 0 : L.padX);
  const y0 = 0, y1 = L.yBin + L.fBin * 0.45;
  return shot ? { x0: W0 - x1, x1: W0 - x0, y0, y1 } : { x0, x1, y0, y1 };
}
function renderCuts(ctx, cfg, tl, t) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const G = cutGeometry(cfg, tl, W, H);
  const W0 = 1920, H0 = 320, L = layout(W0, H0);   // striscia virtuale 6:1
  const offAlpha = G.c.cutOthers ? (cfg.inactive === 'hide' ? 0 : cfg.inactive === 'dim' ? cfg.dimAlpha : cfg.showAlpha) : 0;
  const F = frameState(cfg, tl, t, offAlpha);
  F.onlyActive = !G.c.cutOthers;
  const shot = cfg.view === 'shot';
  const fit = (r) => {
    const box = G.handsBox, pad = G.c.cutPad;
    const s = Math.min((box.w * (1 - 2 * pad)) / (r.x1 - r.x0), (box.h * (1 - pad)) / (r.y1 - r.y0));
    return { s, tx: box.x + box.w / 2 - s * (r.x0 + r.x1) / 2, ty: box.y + box.h / 2 - s * (r.y0 + r.y1) / 2 };
  };
  let V = fit(cropFor(F.seg.active, L, W0, shot));
  // movimento di camera opzionale: dall'inquadratura del cut precedente a quella nuova
  const since = t - F.seg.t0;
  if (G.c.cutMove === 'zoom' && F.st.k > 0 && G.c.cutZoomMs > 0 && since * 1000 < G.c.cutZoomMs) {
    const A = fit(cropFor(tl.segs[F.st.k - 1].active, L, W0, shot)), k = ease((since * 1000) / G.c.cutZoomMs);
    V = { s: A.s + (V.s - A.s) * k, tx: A.tx + (V.tx - A.tx) * k, ty: A.ty + (V.ty - A.ty) * k };
  }
  ctx.save();
  ctx.fillStyle = cfg.bg; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.setTransform(V.s, 0, 0, V.s, V.tx, V.ty);
  drawStrip(ctx, cfg, F, { ...L, handsBottom: H0 * 4 }, W0);
  ctx.restore();
  const n = (cfg.showDec ? 1 : 0) + (cfg.showYears ? 1 : 0);
  drawText(ctx, cfg, tl, F, { f: G.f, fLabel: G.f * 0.8, cx: W / 2, yDec: G.textTop, yYears: G.textTop + (cfg.showDec ? G.lineH : 0),
    yTable: G.textTop + (n ? (n + 1) * G.lineH : 0), lineH: G.lineH, rows: G.rows, x0: W * 0.06, x1: W * 0.94 });
  ctx.restore();
  return F.st;
}

// metronomo: un click per ogni cambio di numero, accento al cambio di scatto
export function metronomePCM(tl, sampleRate = 48000) {
  const N = Math.ceil(tl.duration * sampleRate);
  const pcm = new Float32Array(N);
  const click = (t, accent) => {
    const i0 = Math.round(t * sampleRate), f = accent ? 1760 : 1046.5, len = Math.round(0.05 * sampleRate);
    for (let i = 0; i < len && i0 + i < N; i++) {
      const env = Math.exp(-i / (0.008 * sampleRate));
      pcm[i0 + i] += (accent ? 0.7 : 0.45) * env * Math.sin((2 * Math.PI * f * i) / sampleRate);
    }
  };
  for (const s of tl.segs) {
    for (let t = s.t0; t < s.t1 - 1e-9; t += 1) click(t, t === s.t0 && s.k > 0);
  }
  return pcm;
}
