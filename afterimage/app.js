import { resolveItem, queryFor } from './archive.js';
import { CandidatePool, Semaphore } from './pool.js';
import { captionTerms } from './terms.js';
import { prepare, startPlaying, release, captureItemFrame, waitFor, bufferAhead, MAX_PLAY_SECONDS } from './media.js';
import { renderInfo, toggleInfo } from './info.js';
import { setWaiting, addLoadingImages, finishLoading } from './loading.js';
import { beginChain, describeChain, queryChain, finishChain, exportChain } from './history.js';

const stage = document.querySelector('#stage');
const skipArea = document.querySelector('#skipArea');
const favicon = document.querySelector('#favicon');
const slots = Array.from({ length: 6 }, () => {
  const video = document.createElement('video');
  video.muted = true; video.preload = 'auto'; video.playsInline = true; video.loop = false;
  video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); stage.append(video);
  return { video, media: null, item: null, role: 'idle', kind: null, controller: null, claim: null };
});
const state = {
  step: 'query', modelStatus: 'caricamento…', caption: '', terms: [], query: queryFor([]),
  checked: 0, total: null, next: null, message: 'ricerca del primo video…', downloadStatus: '',
  switches: 0, fallbacks: 0, muted: true, fitMode: 'fit', preview: '', frameTime: null, inferenceMs: null,
  queueGeneral: 0, queueSemantic: 0, loading: 0, buffer: 0, elapsed: 0, prepareMs: null,
};
let active, switching = false, generation = 0, context;
let worker, workerReady, rpcID = 0;
const pending = new Map(), recent = new Set(), failed = new Map();
const lifetime = new AbortController();
const network = new Semaphore(3);
const generalPool = new CandidatePool([], lifetime.signal, result => {
  addLoadingImages(result.items);
  if (!active) update({ query: result.query, total: result.total, message: 'cerco derivati video leggeri…' });
});
const update = changes => {
  Object.assign(state, changes);
  if (!active && /archive.*(?:http|disponibile)|backend_error|timeout|failed to fetch/i.test(changes.message || '')) document.querySelector('#info').hidden = false;
  renderInfo(state, active);
};
const delay = (ms, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(signal.reason);
  const done = () => { signal.removeEventListener('abort', abort); resolve(); };
  const timer = setTimeout(done, ms);
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  signal.addEventListener('abort', abort, { once: true });
});
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
function makeWorker() {
  worker = new Worker(new URL('./vision-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      if (data.status === 'progress') update({ modelStatus: `Download ${data.file}: ${Math.round(data.progress || 0)}%` });
      return;
    }
    const request = pending.get(data.id); if (!request) return;
    pending.delete(data.id); clearTimeout(request.timer);
    data.error ? request.reject(new Error(data.error)) : request.resolve(data);
  };
  worker.onerror = event => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error(event.message || 'Errore worker visivo')); }
    pending.clear();
  };
}
function rpc(data, transfer = [], timeout = 240000) {
  const id = ++rpcID;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error('Timeout modello locale');
      worker?.terminate(); worker = null; workerReady = null;
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
      pending.clear();
    }, timeout);
    pending.set(id, { resolve, reject, timer }); worker.postMessage({ ...data, id }, transfer);
  });
}
async function ensureModel() {
  if (!workerReady) {
    if (!worker) makeWorker();
    workerReady = rpc({ type: 'warmup' }).then(() => update({ modelStatus: 'Pronto · nessuna API remota' })).catch(error => {
      workerReady = null; worker?.terminate(); worker = null;
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear();
      throw error;
    });
  }
  return workerReady;
}

function remember(id) {
  recent.add(id); if (recent.size > 128) recent.delete(recent.values().next().value);
}
const readySlots = kind => slots.filter(slot => slot.role === 'ready' && (!kind || slot.kind === kind));
function excluded(id) {
  return recent.has(id) || (failed.get(id) || 0) > performance.now() || slots.some(slot => slot.claim === id);
}
function invalidateSemantic() {
  context?.controller.abort();
  for (const slot of slots) if (slot !== active && slot.kind === 'semantic') {
    slot.controller?.abort(); if (slot.role === 'ready') { release(slot); slot.claim = null; }
  }
}
function trimGeneral() {
  const general = slots.filter(slot => slot !== active && slot.kind === 'general')
    .sort((a, b) => Number(b.role === 'ready') - Number(a.role === 'ready'));
  for (const slot of general.slice(2)) {
    slot.controller?.abort(); if (slot.role === 'ready') { release(slot); slot.claim = null; }
  }
}
async function fill(slot, kind, cycle = context) {
  const token = slot.token = Symbol();
  const controller = slot.controller = new AbortController();
  const signal = kind === 'semantic' ? AbortSignal.any([controller.signal, cycle.controller.signal]) : controller.signal;
  const pool = kind === 'semantic' ? cycle.pool : generalPool;
  slot.role = 'resolving'; slot.kind = kind;
  try {
    for (let attempts = 0; attempts < 6 && !signal.aborted; attempts++) {
      const entry = await abortable(pool.take(excluded), signal);
      if (!entry) { await delay(1200, signal); continue; }
      slot.claim = entry.candidate.identifier;
      update({ checked: state.checked + 1 });
      try {
        const candidate = await resolveItem(entry.candidate, pool.terms, signal);
        if (!candidate) { failed.set(slot.claim, performance.now() + 60000); slot.claim = null; continue; }
        slot.role = 'buffering';
        if (kind === 'semantic' || !active) update({ step: 'precaricamento', message: `preparo ${candidate.title}` });
        const began = performance.now();
        slot.media = await network.run(() => prepare(slot.video, candidate.streamURL, signal, { startup: !active, middle: candidate.collections.includes('prelinger') }), signal, kind === 'semantic' ? 1 : 0);
        if (signal.aborted || kind === 'semantic' && cycle !== context) return;
        slot.item = { ...candidate, incoming: kind === 'semantic' ? {
          parentID: cycle.parent.id, parentTitle: cycle.parent.title, terms: [...pool.terms],
          caption: cycle.caption, keywords: cycle.allKeywords, frameTime: cycle.frameTime,
          query: entry.result.query, kind: 'query',
        } : null };
        slot.role = 'ready';
        update({ prepareMs: performance.now() - began });
        if (kind === 'semantic') update({ step: 'pronto', next: slot.item, query: entry.result.query, message: 'successore della query pronto' });
        if (!active && !switching) promote(slot, 'startup');
        return;
      } catch (error) {
        if (signal.aborted) return;
        failed.set(slot.claim, performance.now() + 60000);
        release(slot); slot.kind = kind; slot.role = 'resolving'; slot.claim = null;
        if (kind === 'semantic' || !active) update({ message: `${error.message}; provo un altro candidato…` });
      }
    }
  } catch (error) {
    if (!signal.aborted && (kind === 'semantic' || !active)) update({ message: error.message });
  } finally {
    if (slot.token === token && slot.role !== 'ready' && slot.role !== 'active') {
      release(slot); slot.claim = null; slot.retryAt = performance.now() + 800;
    }
    pump();
  }
}
function pump() {
  if (active) trimGeneral();
  const generalTarget = active ? 2 : 4;
  let general = slots.filter(slot => slot !== active && slot.kind === 'general').length;
  let semantic = slots.filter(slot => slot !== active && slot.kind === 'semantic').length;
  for (const slot of slots) {
    if (slot.role !== 'idle' || (slot.retryAt || 0) > performance.now()) continue;
    if (context?.pool && semantic < 3) { semantic++; fill(slot, 'semantic'); }
    else if (general < generalTarget) { general++; fill(slot, 'general'); }
  }
  state.queueGeneral = readySlots('general').length;
  state.queueSemantic = readySlots('semantic').length;
  state.loading = slots.filter(slot => ['resolving', 'buffering'].includes(slot.role)).length;
  skipArea.disabled = false;
}
async function analyze(cycle) {
  const signal = cycle.controller.signal;
  for (let attempt = 0; attempt < 3 && cycle === context; attempt++) {
    try {
      await abortable(ensureModel(), signal);
      const settle = Math.min(600, active.media.seconds * 120) - (performance.now() - active.startedAt);
      if (settle > 0) await delay(settle, signal);
      await waitFor(() => !active.video.seeking && active.video.readyState >= 2, signal);
      const frame = await captureItemFrame(active, signal);
      if (cycle !== context || signal.aborted) return;
      favicon.href = frame.preview; cycle.frameTime = frame.time;
      update({ step: 'modello', preview: frame.preview, frameTime: frame.time, frameSource: frame.source, modelStatus: 'descrizione del fotogramma…' });
      const result = await abortable(rpc({ type: 'caption', pixels: frame.pixels, width: frame.width, height: frame.height }, [frame.pixels], 45000), signal);
      if (cycle !== context || signal.aborted) return;
      const terms = captionTerms(result.caption);
      cycle.caption = result.caption; cycle.keywords = [...terms]; cycle.allKeywords = [...terms];
      describeChain(result.caption, terms, { time: frame.time, source: frame.source });
      update({ step: 'keyword', caption: result.caption, terms, inferenceMs: result.inferenceMs, modelStatus: 'pronto · inferenza locale' });
      if (!terms.length) { await delay(4000, signal); continue; }
      nextKeyword(cycle); return;
    } catch (error) {
      if (signal.aborted || cycle !== context) return;
      update({ message: error.message }); await delay(4500, signal).catch(() => {});
    }
  }
}
function nextKeyword(cycle) {
  const term = cycle.keywords.shift(); if (!term) return;
  cycle.pool = new CandidatePool([term], cycle.controller.signal, result => {
    if (cycle !== context) return;
    queryChain(term, result.query, result.total);
    update({ step: 'query', query: result.query, total: result.total, selectedTerm: term });
    // An empty query can move to another literal keyword without re-running vision.
    if (!result.total && cycle.keywords.length) setTimeout(() => {
      if (cycle === context && !cycle.controller.signal.aborted) {
        for (const slot of slots) if (slot !== active && slot.kind === 'semantic' && slot.role !== 'ready') slot.controller?.abort();
        cycle.pool = null; nextKeyword(cycle);
      }
    }, 1000);
  });
  queryChain(term, queryFor([term]));
  update({ step: 'query', query: queryFor([term]), selectedTerm: term, total: null }); pump();
}
async function promote(next, reason) {
  if (switching || next.role !== 'ready') return;
  switching = true;
  const old = active;
  try {
    // Ready streams already have decoded data. Keep the old frame visible
    // until the new decoder renders; never open a tab or start a search here.
    if (!old) await finishLoading();
    next.video.muted = true; await startPlaying(next.video);
    next.video.muted = state.muted;
    if (next.kind !== 'semantic' && old) next.item.incoming = {
      parentID: old.item.id, parentTitle: old.item.title, caption: context?.caption || '',
      keywords: context?.allKeywords || [], terms: [], query: '', kind: reason === 'click' ? 'click' : 'random',
    };
    if (old) finishChain(next.item, reason);
    beginChain(next.item, reason);
    next.video.classList.toggle('fill', state.fitMode === 'fill');
    next.video.classList.add('on'); old?.video.classList.remove('on');
    active = next; active.role = 'active'; active.startedAt = performance.now();
    active.lastTime = next.video.currentTime; active.lastProgress = performance.now();
    invalidateSemantic();
    remember(next.item.id);
    update({ switches: state.switches + Number(!!old), fallbacks: state.fallbacks + Number(!!old && next.kind !== 'semantic'),
      step: 'modello', caption: '', terms: [], selectedTerm: '', query: '', total: null, next: null, preview: '', frameTime: null, inferenceMs: null, message: 'analisi del video corrente…' });
    if (old) { release(old); old.claim = null; }
    context = { id: ++generation, parent: next.item, controller: new AbortController(), pool: null, keywords: [] };
    const reveal = setWaiting(false); analyze(context); await reveal;
  } catch (error) {
    release(next); next.claim = null; update({ message: error.message });
  } finally { switching = false; pump(); }
}
function tick() {
  // Enforce the cap even while the next decoder is starting asynchronously.
  if (active && !document.hidden && performance.now() - active.startedAt >= MAX_PLAY_SECONDS * 1000) active.video.pause();
  if (active && !switching && !document.hidden) {
    const video = active.video, now = performance.now();
    const elapsed = (now - active.startedAt) / 1000;
    const semantic = readySlots('semantic')[0], general = readySlots('general')[0];
    if (Math.abs(video.currentTime - active.lastTime) > .02) {
      active.lastTime = video.currentTime; active.lastProgress = now;
    }
    const stalled = !video.paused && now - active.lastProgress > 2200;
    const ended = video.ended || video.currentTime >= active.media.start + active.media.seconds - .15;
    const deadline = MAX_PLAY_SECONDS;
    if (semantic) promote(semantic, 'query');
    else if (general && (elapsed >= deadline || ended || stalled)) promote(general, 'fallback');
    else if (elapsed >= deadline || ended || stalled) {
      if (elapsed >= deadline || ended) video.pause();
      setWaiting(true);
    } else if (!video.paused && video.readyState >= 3) setWaiting(false);
    state.elapsed = elapsed; state.buffer = bufferAhead(video);
  }
  requestAnimationFrame(tick);
}
let firstClick = true;
function skipReady() {
  if (!active || switching) return;
  const next = readySlots('semantic')[0] || readySlots('general')[0];
  if (next) promote(next, 'click');
}
document.addEventListener('click', event => {
  if (firstClick) {
    firstClick = false;
    state.muted = false;
    // Unlock audio inside the first user gesture, even during loading.
    for (const { video } of slots) video.muted = false;
    if (active && !active.video.ended && state.elapsed < MAX_PLAY_SECONDS) active.video.play().catch(() => {});
    renderInfo(state, active);
    return;
  }
  if (event.target.closest('#info')) return;
  skipReady();
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (['i', 'm', 'f', 'c', 's', 'arrowright'].includes(key)) {
    event.preventDefault();
    if (document.activeElement === skipArea) skipArea.blur();
  }
  if (key === 'arrowright') { event.preventDefault(); skipReady(); }
  if (key === 'i') { toggleInfo(); renderInfo(state, active); }
  if (key === 'm') { state.muted = !state.muted; if (active) active.video.muted = state.muted; renderInfo(state, active); }
  if (key === 'f') {
    const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    action.catch(error => update({ message: error.message }));
  }
  if (key === 'c' && active) {
    const fill = active.video.classList.toggle('fill');
    update({ fitMode: fill ? 'fill' : 'fit' });
  }
  if (key === 's') exportChain();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { active?.video.pause(); if (active) active.hiddenAt = performance.now(); }
  else if (active) {
    active.startedAt += performance.now() - (active.hiddenAt || performance.now());
    active.lastProgress = performance.now(); active.video.play().catch(() => {});
  }
});
setInterval(() => { pump(); renderInfo(state, active); }, 300);
requestAnimationFrame(tick);
// The first stream gets the connection first; analyze() starts the model once
// a video is playing, independently from future random/semantic reserves.
pump();
