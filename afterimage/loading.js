import { loadingArt } from './loading-art.js';
import { archiveJSON } from './archive-transport.js';
import { report } from './report.js';
// Start screen: a fast, even burst of random Archive pictures; when the first
// video is ready it appears through the burst, which keeps running while it
// fades away (no white in between).
const overlay = document.querySelector('#loading');
let picture = document.querySelector('.loading-picture');
document.querySelector('.loading-art').innerHTML = loadingArt;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Length of the burst → first video fade (the sound rises with it).
export const FADE_MS = 6000;
// An even beat: the burst starts once a few pictures are decoded and waiting,
// and its pace follows how fast pictures actually arrive (as fast as one every
// FRAME_MS), so every picture stays about as long as the others instead of
// some freezing while the network catches up.
const FRAME_MS = reduced ? 1500 : 110, SLOWEST_MS = 420, START_WITH = 4, RESERVE = 20, PARALLEL = 10;
const arrivals = [];
const identifiers = [], known = new Set(), ready = [];
let mode = 'hidden', timer, inFlight = 0, started = false, searching = false, retryAt = 0, backoff = 600;
let searchController, reveal;
// Thumbnails of the videos being drawn come for free; a separate image search
// only tops the list up when it runs low.
export function addLoadingImages(items) {
  if (mode !== 'waiting') return;
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  for (const item of shuffled) {
    const id = typeof item === 'string' ? item : item.identifier;
    if (!id || known.has(id)) continue;
    known.add(id); identifiers.push(id);
  }
  preload();
}
async function refill() {
  if (searching || mode !== 'waiting' || Date.now() < retryAt) return;
  searching = true; searchController = new AbortController();
  try {
    // Images published after a random moment of the whole image library
    // (2004 → now), in date order: a fast date-window query, never the same
    // first/last 10,000 identifiers.
    const from = Date.UTC(2004, 0, 1), moment = new Date(from + Math.random() * (Date.now() - from)).toISOString().replace(/\.\d+Z$/, 'Z');
    const params = new URLSearchParams({ q: `mediatype:image AND publicdate:[${moment} TO *]`, rows: '60', page: '1', output: 'json', 'fl[]': 'identifier', 'sort[]': 'publicdate asc' });
    const data = await archiveJSON('https://archive.org/advancedsearch.php?' + params, searchController.signal, { scrape: false });
    addLoadingImages(data.response?.docs || []);
    backoff = 600;
  } catch {
    // Archive unreachable or refusing: wait longer and longer (up to 30 s), so
    // the page does not keep hammering a service that is limiting us.
    backoff = Math.min(30000, backoff * 2);
  } finally { searching = false; retryAt = Date.now() + backoff; }
}
function preload() {
  // Small thumbnails (low quality is fine), a few at a time, each fully
  // decoded before it joins the reserve, so showing it never waits.
  while (['waiting', 'ending', 'reveal'].includes(mode) && inFlight < PARALLEL && ready.length + inFlight < RESERVE && identifiers.length) {
    const image = new Image(), id = identifiers.shift();
    inFlight++; image.decoding = 'async'; image.fetchPriority = 'low';
    let settled = false;
    const finish = success => {
      if (settled) return; settled = true; clearTimeout(timeout); inFlight--;
      image.onload = image.onerror = null;
      if (success && image.naturalWidth && mode !== 'hidden') { ready.push(image); arrivals.push(performance.now()); if (arrivals.length > 12) arrivals.shift(); }
      preload();
    };
    const timeout = setTimeout(() => finish(false), 3000);
    image.onload = () => image.decode().then(() => finish(true), () => finish(false)); image.onerror = () => finish(false);
    image.src = 'https://archive.org/services/img/' + encodeURIComponent(id);
  }
  if (mode === 'waiting' && identifiers.length < 24) refill();
}
function showNext() {
  if (!started && ready.length < START_WITH && mode === 'waiting') return;
  if (!ready.length) return;
  started = true;
  // FIFO: each picture is shown once, the loaded pool is never cycled.
  const image = ready.shift();
  image.className = 'loading-picture'; image.alt = ''; image.setAttribute('aria-hidden', 'true');
  picture.replaceWith(image); picture = image; report.firstPicture();
}
function cycle() {
  showNext(); preload();
  timer = setTimeout(cycle, beat());
}
// Average time between arrivals; a full reserve allows the fastest beat.
function beat() {
  if (reduced) return FRAME_MS;
  if (ready.length >= 8 || arrivals.length < 3) return FRAME_MS;
  const spacing = (performance.now() - arrivals[0]) / arrivals.length;
  return Math.max(FRAME_MS, Math.min(SLOWEST_MS, spacing * (ready.length >= 3 ? 1 : 1.25)));
}
function stopImages() {
  clearTimeout(timer); searchController?.abort(); ready.length = 0; identifiers.length = 0;
}
// The first video is ready: no more searches, the burst goes on with what is
// already on its way.
export async function finishLoading() {
  if (mode !== 'waiting') return;
  mode = 'ending'; searchController?.abort();
  // Without any picture yet there is nothing to blend: the video fades in from white.
  if (!started) { clearTimeout(timer); overlay.classList.add('white'); }
}
// setWaiting(false) after finishLoading() fades the burst away over the playing
// video and returns a promise that settles when the video is fully visible.
export function setWaiting(value) {
  if (mode === 'ending' && !value) {
    mode = 'reveal';
    const animation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'linear', fill: 'forwards' });
    reveal = animation;
    return animation.finished.catch(() => {}).then(() => {
      if (reveal !== animation) return;
      if (mode === 'reveal') { mode = 'hidden'; stopImages(); overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
      animation.cancel(); reveal = null;
    });
  }
  if (value && mode === 'waiting' || !value && (mode === 'hidden' || mode === 'reveal')) return;
  if (value) {
    clearTimeout(timer); reveal?.cancel(); reveal = null;
    mode = 'waiting'; started = false; overlay.hidden = false;
    overlay.classList.remove('white', 'blank'); overlay.setAttribute('aria-hidden', 'false');
    cycle();
  } else if (mode === 'waiting') {
    mode = 'hidden'; stopImages(); overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true');
  }
}
setWaiting(true);
