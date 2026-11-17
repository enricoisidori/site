// node counting/build-slides.mjs → counting/slides/log-table.svg (slide 1920×1080 nello stile del deck)
import { writeFileSync } from 'node:fs';
import { DEFAULT_CFG, buildTimeline, fmtHuman, fmtClock, PEOPLE } from './counting.js';

const cfg = { ...DEFAULT_CFG, video: 2, mode: 'log' };
const T = BigInt(cfg.T);
const tl = buildTimeline(cfg);
const dots = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const sci = (n) => {
  if (n === 0n) return '0';
  const s = n.toString(), e = s.length - 1;
  return `${s[0]},${s.slice(1, 3)} × 10${String(e).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('')}`;
};
const rootT = (k) => { // T^(k/5) arrotondato (BigInt via log)
  const l = (Math.log(Number(T)) * k) / 5;
  return k === 5 ? T : BigInt(Math.round(Math.exp(l)));
};
const eu = (s) => s.replace(/(\d)\.(\d)/g, '$1,$2'); // decimali con la virgola, come nel deck
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const F = `font-family="'Neue Haas Grotesk Display Pro', 'Neue Haas Grotesk Text Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="20" fill="#000"`;
const t = (x, y, s, extra = '') => `<text x="${x}" y="${y}"${extra}>${esc(s)}</text>`;

const cols = [30, 150, 330, 820, 1060, 1560, 1790];
const head = ['Cut', 'In the video', 'Log moment  T^(k/5)', '', 'Shown on the hands', 'After the Big Bang', 'People'];
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">`);
out.push(`<rect width="1920" height="1080" fill="#fff"/><g ${F}>`);
out.push(t(30, 50, 'Counting by hands, 2026'));
out.push(t(30, 78, `Video 2, ${tl.segs.length} cuts every ${cfg.segDur} seconds (${fmtClock(tl.duration)}): from the Big Bang to today on a logarithmic scale.`));
out.push(t(30, 106, `Each cut multiplies the time by T^(1/5) ≈ ${sci(rootT(1))} s. Person 6 keeps counting through every cut; all the other hands change.`));
let y = 196;
head.forEach((h, i) => h && out.push(t(cols[i], y, h)));
y += 14; out.push(`<line x1="30" x2="1890" y1="${y}" y2="${y}" stroke="#000" stroke-width="1"/>`);
y += 44;
tl.segs.forEach((s, k) => {
  const m = k === 0 ? 0n : rootT(k);
  const row = [String(k + 1), `${fmtClock(s.t0)}–${fmtClock(s.t1)}`, k === 0 ? '0' : dots(m) + ' s', k === 0 ? '' : '≈ ' + sci(m) + ' s',
    dots(s.n0) + ' s', eu(fmtHuman(s.n0, 'en')), `${s.active} of ${PEOPLE}`];
  row.forEach((c, i) => c && out.push(t(cols[i], y, c)));
  y += 56;
});
y -= 30; out.push(`<line x1="30" x2="1890" y1="${y}" y2="${y}" stroke="#000" stroke-width="1"/>`);
out.push(t(30, y + 44, `T = ${dots(T)} s = ${eu(fmtHuman(T, 'en'))}. The number on the hands is close to the log moment but never round: hands that change take new positions with at least two fingers up.`));
out.push(t(30, 1043, 'Contento360'));
out.push(t(970, 1043, 'Enrico Isidori'));
out.push('</g></svg>');
writeFileSync(new URL('./slides/log-table.svg', import.meta.url), out.join('\n'));
console.log('ok');
