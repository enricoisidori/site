// Embedded by build-image.mjs: image.html needs no server or module imports.
const stage = document.querySelector('main');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const queue = [], ids = [], seen = new Set(), totals = new Map();
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
const sorts = ['identifier asc', 'identifier desc', 'addeddate asc', 'addeddate desc'];
let current, inFlight = 0, searching = false, nextSearch = 0, last = -Infinity, timer;
const pick = values => values[Math.floor(Math.random() * values.length)];
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}
function remember(items) {
  for (const item of shuffle([...items])) {
    const id = typeof item === 'string' ? item : item.identifier;
    if (!id || seen.has(id)) continue;
    seen.add(id); ids.push(id);
  }
  try { localStorage.setItem('image:seeds:v1', JSON.stringify(ids.slice(-150))); } catch {}
}
async function refill() {
  if (searching || Date.now() < nextSearch || document.hidden) return;
  searching = true;
  const prefix = pick(alphabet), total = totals.get(prefix);
  const page = total ? 1 + Math.floor(Math.random() * Math.ceil(Math.min(total, 10000) / 100)) : 1;
  const params = new URLSearchParams({q:'mediatype:image AND NOT access-restricted-item:true AND identifier:' + prefix + '*', rows:'100', page:String(page), output:'json', 'fl[]':'identifier', 'sort[]':pick(sorts)});
  try {
    const data = await archiveJSON('https://archive.org/advancedsearch.php?' + params, AbortSignal.timeout(12000));
    totals.set(prefix, Number(data.response?.numFound) || 0);
    remember(data.response?.docs || []);
    nextSearch = Date.now() + 250;
  } catch { nextSearch = Date.now() + 1500; }
  finally { searching = false; pump(); }
}
function pump() {
  if (document.hidden) return;
  while (inFlight < 4 && queue.length + inFlight < 10 && ids.length) {
    const image = new Image(), id = ids.shift();
    image.decoding = 'async'; image.fetchPriority = current ? 'low' : 'high';
    inFlight++;
    let settled = false;
    const finish = success => {
      if (settled) return; settled = true; clearTimeout(timeout);
      image.onload = image.onerror = null; inFlight--;
      if (success && image.naturalWidth) { queue.push(image); show(); }
      pump();
    };
    const timeout = setTimeout(() => finish(false), 6000);
    image.onload = () => image.decode().then(() => finish(true), () => finish(false));
    image.onerror = () => finish(false);
    image.src = 'https://archive.org/services/img/' + encodeURIComponent(id);
  }
  if (ids.length < 25) refill();
}
function show() {
  if (document.hidden || !queue.length || performance.now() - last < (reduced ? 1500 : 120)) return;
  const image = queue.shift(); image.alt = ''; image.draggable = false;
  if (current) current.replaceWith(image); else stage.append(image);
  current = image; last = performance.now();
}
function cycle() {
  clearTimeout(timer);
  if (document.hidden) return;
  show(); pump(); timer = setTimeout(cycle, reduced ? 1500 : 60);
}
document.addEventListener('visibilitychange', cycle);
try { remember(JSON.parse(localStorage.getItem('image:seeds:v1') || '[]')); } catch {}
cycle();
