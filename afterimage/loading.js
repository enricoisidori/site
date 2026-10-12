import { loadingArt } from './loading-art.js';
import { archiveJSON } from './archive-transport.js';
const overlay = document.querySelector('#loading');
let picture = document.querySelector('.loading-picture');
document.querySelector('.loading-art').innerHTML = loadingArt;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cacheKey = document.title + ':loading-images:v1';
const identifiers = [], known = new Set(), ready = [];
let mode = 'hidden', timer, inFlight = 0, lastShown = -Infinity, searching = false, retryAt = 0;
let searchController, reveal;
export function addLoadingImages(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  for (const item of shuffled) {
    const id = typeof item === 'string' ? item : item.identifier;
    if (!id || known.has(id)) continue;
    known.add(id); identifiers.push(id);
  }
  try { localStorage.setItem(cacheKey, JSON.stringify([...known].slice(-100))); } catch {}
  preload();
}
async function refill() {
  if (searching || mode !== 'waiting' || Date.now() < retryAt) return;
  searching = true; searchController = new AbortController();
  try {
    const params = new URLSearchParams({ q: 'mediatype:image', rows: '50', page: String(1 + Math.floor(Math.random() * 200)), output: 'json', 'fl[]': 'identifier', 'sort[]': Math.random() < .5 ? 'identifier asc' : 'identifier desc' });
    const data = await archiveJSON('https://archive.org/advancedsearch.php?' + params, searchController.signal);
    if (mode === 'waiting') addLoadingImages(data.response?.docs || []);
  } catch {} finally { searching = false; retryAt = Date.now() + 1000; }
}
function preload() {
  while (mode === 'waiting' && inFlight < 3 && ready.length < 6 && identifiers.length) {
    const image = new Image(), id = identifiers.shift();
    inFlight++; image.decoding = 'async'; image.fetchPriority = picture.getAttribute('src') ? 'low' : 'high';
    let settled = false;
    const finish = success => {
      if (settled) return; settled = true; clearTimeout(timeout); inFlight--;
      image.onload = image.onerror = null;
      if (success && mode === 'waiting' && image.naturalWidth) {
        ready.push(image); showNext();
      }
      preload();
    };
    const timeout = setTimeout(() => finish(false), 5000);
    image.onload = () => image.decode().then(() => finish(true), () => finish(false)); image.onerror = () => finish(false);
    image.src = 'https://archive.org/services/img/' + encodeURIComponent(id);
  }
  if (mode === 'waiting' && identifiers.length < 8) refill();
}
function showNext() {
  if (!ready.length || performance.now() - lastShown < (reduced ? 1500 : 120)) return;
  // FIFO, exactly like aleph: consume each frame, never cycle the loaded pool.
  const image = ready.shift();
  image.className = 'loading-picture'; image.alt = ''; image.setAttribute('aria-hidden', 'true');
  picture.replaceWith(image); picture = image; lastShown = performance.now();
}
function cycle() {
  showNext(); preload(); timer = setTimeout(cycle, reduced ? 1500 : 60);
}
function stopImages() {
  clearTimeout(timer); searchController?.abort(); ready.length = 0;
}
export async function finishLoading() {
  mode = 'white'; stopImages();
  overlay.hidden = false; overlay.classList.add('white');
  await new Promise(resolve => setTimeout(resolve, 3000));
  overlay.classList.add('blank');
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Keep white until the caller has actually rendered the first video frame.
}
export function setWaiting(value) {
  if (mode === 'white') {
    if (!value) {
      mode = 'reveal';
      reveal = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 3000, easing: 'linear', fill: 'forwards' });
      return reveal.finished.catch(() => {}).then(() => {
        if (mode === 'reveal') { mode = 'hidden'; overlay.hidden = true; }
        reveal.cancel(); reveal = null;
      });
    }
    return;
  }
  if (value && mode === 'waiting' || !value && (mode === 'hidden' || mode === 'reveal')) return;
  clearTimeout(timer);
  if (value) {
    reveal?.cancel();
    mode = 'waiting'; overlay.hidden = false;
    overlay.classList.remove('white', 'blank'); overlay.setAttribute('aria-hidden', 'false');
    cycle();
  } else {
    mode = 'hidden'; stopImages(); overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true');
  }
}
try { addLoadingImages(JSON.parse(localStorage.getItem(cacheKey) || '[]')); } catch {}
setWaiting(true);
