import { highlightParts } from './terms.js';
// Subtitles: the title of the video stays on screen for most of its time; only
// just before the change is its description written word by word, with the
// search keyword underlined, and left for 2 s. The next video's title then
// appears with the same word underlined at the same place on screen.
const box = document.createElement('div');
box.id = 'subtitles'; box.setAttribute('aria-live', 'polite');
document.body.append(box);
// Minimum reading times: the title before anything else, the finished
// description before the video changes.
const TITLE_MIN_MS = 3000, CAPTION_MIN_MS = 2000;
let titleAt = 0, typing = null, caption = '', term = '', shown = 0, doneAt = null, gate = null, run = 0;

// Subtitles stay hidden until `promise` settles (the first video fading in).
export function revealAfter(promise) {
  const current = gate = Promise.resolve(promise).catch(() => {});
  box.style.visibility = 'hidden'; titleAt = Infinity;
  current.then(() => { if (gate !== current) return; gate = null; box.style.visibility = ''; titleAt = performance.now(); });
}
// True once the title has been on screen 3 s and the description, if there is
// one, has been written and left complete for 2 s.
export function readEnough(now = performance.now()) {
  return now - titleAt >= TITLE_MIN_MS && (!caption || doneAt != null && now - doneAt >= CAPTION_MIN_MS);
}
// Seconds the current title has been on screen (0 while still hidden).
export function titleSeconds(now = performance.now()) { return Math.max(0, (now - titleAt) / 1000); }
// 'none' (no description yet), 'waiting' (known, not written), 'typing', 'done'.
export function captionState() {
  return !caption ? 'none' : doneAt == null ? 'waiting' : doneAt === Infinity ? 'typing' : 'done';
}

function line(className) { const el = document.createElement('div'); el.className = 'line ' + (className || ''); box.append(el); return el; }
// Text with the keyword underlined; only the first `words` words are visible.
// Words not written yet keep their place (hidden), so the line does not shift.
// The visible part of the keyword is a single element, so its underline runs
// on across the spaces.
function fill(target, text, keyword, words = Infinity) {
  target.textContent = '';
  let count = 0;
  for (const part of highlightParts(text, keyword ? [keyword] : [])) {
    let visible = '', hidden = '';
    for (const piece of part.text.split(/(\s+)/).filter(Boolean)) {
      if (/\S/.test(piece)) count++;
      if (count > words || hidden) hidden += piece; else visible += piece;
    }
    // A space just before hidden words belongs to them, not to the underline.
    const trailing = hidden ? visible.match(/\s*$/)[0] : '';
    visible = visible.slice(0, visible.length - trailing.length); hidden = trailing + hidden;
    if (visible) {
      if (part.match) { const u = document.createElement('u'); u.textContent = visible; target.append(u); }
      else target.append(visible);
    }
    if (hidden) { const ghost = document.createElement('span'); ghost.className = 'ghost'; ghost.textContent = hidden; target.append(ghost); }
  }
  return count;
}

// Horizontal centre of the underlined word currently on screen, if any.
export function anchor() {
  const u = box.querySelector('.caption u');
  if (!u) return null;
  const r = u.getBoundingClientRect();
  return r.width ? r.left + r.width / 2 : null;
}

// One unwrapped row whose underlined word is centred on anchorX, as far as the
// screen allows. Returns false (and leaves the row empty) when it does not fit.
function anchoredRow(row, text, keyword, anchorX) {
  row.textContent = ''; row.classList.remove('anchored');
  const inner = document.createElement('span');
  // Measured at its natural width: a capped width would hide an overflow.
  inner.className = 'inner'; inner.style.whiteSpace = 'nowrap'; inner.style.maxWidth = 'none'; row.append(inner);
  fill(inner, text, keyword);
  const style = getComputedStyle(row), pad = parseFloat(style.paddingLeft);
  const available = row.clientWidth - pad - parseFloat(style.paddingRight);
  const width = inner.getBoundingClientRect().width, u = inner.querySelector('u');
  if (width > available) { row.textContent = ''; return false; }
  if (u && anchorX != null) {
    const ur = u.getBoundingClientRect(), mid = ur.left + ur.width / 2 - inner.getBoundingClientRect().left;
    row.classList.add('anchored');
    inner.style.marginLeft = Math.max(0, Math.min(available - width, anchorX - row.getBoundingClientRect().left - pad - mid)) + 'px';
  }
  return true;
}

export function showTitle(title, { keyword = '', anchorX = null, newSession = false } = {}) {
  clearTimeout(typing); typing = null; caption = ''; term = ''; shown = 0; doneAt = null; run++;
  box.textContent = ''; titleAt = gate ? Infinity : performance.now();
  if (newSession) line('session').textContent = 'NEW SESSION: random video among all internet archive';
  const row = line('title');
  if (anchoredRow(row, title, keyword, anchorX)) return;
  // Too long for one row. When the underlined word is in the first row, that
  // row keeps the alignment and the rest follows centred, wrapping as needed;
  // otherwise the whole title is simply centred and wrapped.
  const words = title.trim().split(/\s+/);
  for (let n = words.length - 1; n > 0; n--) {
    const head = words.slice(0, n).join(' ');
    if (!anchoredRow(row, head, keyword, anchorX)) continue;
    if (keyword && highlightParts(head, [keyword]).some(part => part.match)) { fill(line('title'), words.slice(n).join(' '), ''); return; }
    break;
  }
  row.textContent = ''; row.classList.remove('anchored');
  fill(row, title, keyword);
}

function render() {
  let row = box.querySelector('.caption');
  if (!row) { box.textContent = ''; row = line('caption'); }
  fill(row, caption, term, shown);
}
// The description is kept until the change is near (writeCaption).
export function typeCaption(text, keyword = '') {
  clearTimeout(typing); typing = null; caption = text || ''; term = keyword; shown = 0; doneAt = null; run++;
}
// Written out as a model would, quickly and at an uneven pace, once the title
// has had its minimum time.
export function writeCaption() {
  if (!caption || doneAt != null) return;
  doneAt = Infinity; const mine = run;
  const total = caption.split(/\s+/).filter(Boolean).length;
  const step = () => {
    if (mine !== run) return;
    shown++; render();
    if (shown < total) typing = setTimeout(step, 35 + Math.random() * 110 + (Math.random() < .12 ? 180 : 0));
    else { typing = null; doneAt = performance.now(); }
  };
  const start = () => { if (mine === run) typing = setTimeout(step, Math.max(0, titleAt + TITLE_MIN_MS - performance.now())); };
  if (gate) gate.then(start); else start();
}
// The keyword can change after the sentence (a word with no results is skipped).
export function underline(keyword) {
  term = keyword || '';
  if (caption && box.querySelector('.caption')) render();
}
