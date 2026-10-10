import { createSeenVideos } from './seen.js';
import { candidates, resolveItem, searchTerms, metadataMatches, searchPlan } from './archive.js';
import { MIN_VIDEO_SECONDS, MAX_VIDEO_BYTES } from './config.js';
import { setupInfo } from './info.js';
import { setupWords } from './words.js';

const videos = [...document.querySelectorAll('video')];
const status = document.querySelector('#status');
const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const context = canvas.getContext('2d', { willReadFrequently: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let historyStorage;
try { historyStorage = window.localStorage; } catch {}
const seenVideos = createSeenVideos(historyStorage);
const keywordOrigins = new Map();
let current = -1;
let worker;
let requestId = 0;
let visionRetryAt = 0;
let sound = false;
let fullscreenAttempted = false;
// Inspect from the console; the film itself has no interface.
const state = window.spiral = { phase: 'starting', current: null, predictions: [], query: '', history: [], lastError: null, vision: 'loading' };
setupInfo(state, videos);
setupWords(state);

function report(error) {
  state.lastError = String(error?.message || error);
  console.warn('[spiral]', state.lastError);
}

async function vision(message, transfer = []) {
  if (Date.now() < visionRetryAt) return Promise.reject(new Error('Vision temporarily unavailable'));
  worker ||= new Worker(new URL('./vision-worker.js', import.meta.url), { type: 'module' });
  const target = worker;
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const finish = (error, result) => {
      clearTimeout(timer);
      target.removeEventListener('message', onMessage);
      target.removeEventListener('error', onError);
      if (error) {
        target.terminate();
        if (worker === target) worker = null;
        visionRetryAt = Date.now() + 60000;
        state.vision = 'unavailable';
        reject(error);
      } else {
        state.vision = 'ready';
        resolve(result);
      }
    };
    const onMessage = ({ data }) => {
      if (data.id === id) finish(data.error ? new Error(data.error) : null, data.predictions || []);
    };
    const onError = error => finish(new Error(error.message || 'Vision worker failed'));
    const timer = setTimeout(() => finish(new Error('Vision timeout')), 120000);
    target.addEventListener('message', onMessage);
    target.addEventListener('error', onError);
    target.postMessage({ ...message, id }, transfer);
  });
}

function waitMedia(video, event, action, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, success);
      video.removeEventListener('error', failure);
    };
    const success = () => { cleanup(); resolve(); };
    const failure = () => { cleanup(); reject(new Error(`Media ${video.error?.code || 'error'}`)); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Media timeout: ${event}`)); }, timeout);
    video.addEventListener(event, success, { once: true });
    video.addEventListener('error', failure, { once: true });
    try { action?.(); } catch (error) { cleanup(); reject(error); }
  });
}

function release(video) {
  video.pause();
  video.classList.remove('active');
  video.removeAttribute('src');
  video.load();
  if (video.dataset.blob) {
    URL.revokeObjectURL(video.dataset.blob);
    delete video.dataset.blob;
  }
}

async function downloadVideo(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`Video HTTP ${response.status}`);
    if (Number(response.headers.get('Content-Length')) > MAX_VIDEO_BYTES) {
      controller.abort();
      throw new Error('Video exceeds memory limit');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_VIDEO_BYTES) {
        controller.abort();
        throw new Error('Video exceeds memory limit');
      }
      chunks.push(value);
    }
    if (bytes < 10000) throw new Error('Empty or truncated video');
    return URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
  } finally { clearTimeout(timer); }
}

async function prepare(item, slot) {
  const video = videos[slot];
  release(video);
  video.muted = true;
  for (const url of item.urls) {
    try {
      // Fully local playback: waiting on Archive can never stall the active film.
      video.dataset.blob = await downloadVideo(url);
      await waitMedia(video, 'loadedmetadata', () => { video.src = video.dataset.blob; video.load(); });
      if (!Number.isFinite(video.duration) || video.duration < MIN_VIDEO_SECONDS) throw new Error(`Video shorter than ${MIN_VIDEO_SECONDS} seconds`);
      // Leave enough footage ahead, avoiding a title-card bias at t=0.
      const start = Math.random() * Math.max(0, video.duration - 30);
      await waitMedia(video, 'seeked', () => { video.currentTime = Math.max(.05, start); });
      if (video.readyState < 3) await waitMedia(video, 'canplay');
      const filename = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop());
      return { item: { ...item, filename }, slot, start: video.currentTime };
    } catch (error) {
      report(error);
      release(video);
    }
  }
  throw new Error(`Cannot play ${item.id}`);
}

async function next(terms = []) {
  const slot = current === 0 ? 1 : 0;
  const selection = {
    from: state.current?.title || null,
    objects: terms.length ? state.predictions.filter(p => p.score >= .06).slice(0, 3).map(p => ({ ...p })) : [],
    terms: [...terms], attempts: [], query: null, mode: null,
  };
  state.search = selection;
  // After the initial seed, only accept a verified textual association.
  // Try every keyword in titles first, then descriptions, then subjects.
  for (const { term, field } of searchPlan(terms, current < 0)) {
    state.query = term || '(random)';
    const attempt = { query: term || '(random)', field, status: 'Ricerca…', count: null };
    selection.attempts.push(attempt);
    let items;
    try { items = await candidates(term, field, current < 0); } catch (error) { attempt.status = 'Errore archivio'; report(error); continue; }
    attempt.count = items.length;
    attempt.status = items.length ? 'Verifica e download dei candidati…' : 'Nessun risultato';
    for (const candidate of items.filter(item => !seenVideos.has(item.identifier))) {
      try {
        const item = await resolveItem(candidate);
        if (item) {
          if (current < 0 && item.bytes > 12 * 1024 * 1024) continue;
          const matches = term ? metadataMatches(item.searchMetadata, term).filter(m => m.key === field) : [];
          if (term && !matches.length) {
            attempt.status = 'Risultato dell’indice scartato: keyword non verificata';
            continue;
          }
          const prepared = await prepare(item, slot);
          attempt.status = 'Video pronto';
          selection.query = term || null;
          selection.mode = term ? 'visual' : 'initial';
          selection.success = Boolean(term && matches.length);
          selection.field = field;
          selection.to = prepared.item.title;
          selection.matches = matches;
          if (term && keywordOrigins.has(term)) {
            const origin = keywordOrigins.get(term);
            selection.objects = origin.objects;
            selection.from = origin.from;
          }
          selection.status = term ? 'Collegamento verificato: video pronto' : 'Primo video casuale pronto';
          return { ...prepared, selection: structuredClone(selection) };
        }
      } catch (error) { report(error); }
    }
    attempt.status = items.length ? 'Nessun candidato riproducibile tra quelli provati' : 'Nessun risultato';
  }
  state.search.status = 'Collegamento non ancora trovato: il video corrente continua. Riprenderò con nuovi fotogrammi e keyword.';
  throw new Error(current < 0 ? 'No playable candidate found' : state.search.status);
}

function decodedFrame(video) {
  return new Promise((resolve, reject) => {
    let callback;
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      if (callback !== undefined) video.cancelVideoFrameCallback(callback);
      reject(new Error('No decoded frame'));
    }, 12000);
    if (video.requestVideoFrameCallback) {
      callback = video.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(); });
    } else {
      // Older browsers: readyState + a paint boundary before revealing.
      const check = () => {
        if (expired) return;
        if (video.readyState >= 3 && !video.paused) {
          clearTimeout(timer);
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        } else if (!video.paused) requestAnimationFrame(check);
      };
      check();
    }
  });
}

async function cut(prepared) {
  if (seenVideos.has(prepared.item.id)) {
    release(prepared.video || videos[prepared.slot]);
    throw new Error('Video già incontrato: scartato per mantenere la deriva.');
  }
  seenVideos.add(prepared.item.id);
  const incoming = videos[prepared.slot];
  const outgoing = videos[current];
  // Both play muted until incoming has actually decoded a frame.
  try {
    await incoming.play();
    await decodedFrame(incoming);
  } catch (error) {
    release(incoming);
    throw error;
  }
  incoming.classList.add('active');
  if (outgoing) { outgoing.muted = true; release(outgoing); }
  incoming.muted = !sound;
  current = prepared.slot;
  state.current = prepared.item;
  state.selection = prepared.selection;
  state.phase = 'playing';
  state.lastError = null;
  state.history.push({ id: prepared.item.id, source: prepared.item.source, license: prepared.item.license, query: prepared.selection.query, selection: prepared.selection, start: prepared.start, at: new Date().toISOString() });
  if (state.history.length > 200) state.history.shift();
  status.hidden = true;
}

async function recognize() {
  state.phase = 'analyzing';
  const video = videos[current];
  if (!video.videoWidth || video.readyState < 2) throw new Error('No frame to analyze');
  // Preserve the frame proportions; don't stretch archival 4:3 pictures.
  canvas.height = Math.max(1, Math.round(256 * video.videoHeight / video.videoWidth));
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const analysis = { image: canvas.toDataURL('image/jpeg', .8), title: state.current.title, time: video.currentTime };
  const predictions = await vision({ type: 'classify', pixels: frame.data.buffer, width: frame.width, height: frame.height }, [frame.data.buffer]);
  state.predictions = predictions;
  state.analysis = analysis;
  console.info('[spiral] frame', predictions);
  return searchTerms(predictions);
}

// A click on the film enables sound and requests fullscreen, with no controls.
document.addEventListener('click', event => {
  if (event.target.closest('#info')) return;
  sound = true;
  if (current >= 0) { videos[current].muted = false; videos[current].play().catch(report); }
  if (!fullscreenAttempted) {
    fullscreenAttempted = true;
    document.documentElement.requestFullscreen?.().catch(report);
  }
});
document.addEventListener('keydown', event => {
  if (event.code === 'KeyM') {
    sound = !sound;
    if (current >= 0) videos[current].muted = !sound;
  }
});

async function run() {
  // Warmup is shared with the first classification, never a concurrent inference.
  const warmup = vision({ type: 'warmup' }).catch(report);
  while (current < 0) {
    try { status.textContent = 'Ricerca e caricamento di un primo video…'; await cut(await next()); }
    catch (error) {
      report(error);
      status.textContent = 'Archivio non disponibile. Riprovo… (avvia con python3 spiral/server.py)';
      await sleep(6000);
    }
  }
  await warmup;
  let keywordPool = [];
  for (;;) {
    const earliestCut = performance.now() + 12000 + Math.random() * 8000;
    await sleep(2500);
    let terms = [];
    try { terms = await recognize(); } catch (error) { report(error); state.predictions = []; }
    keywordPool = [...new Set([...terms, ...keywordPool])].slice(0, 24);
    for (const term of terms) keywordOrigins.set(term, {
      from: state.current.title,
      objects: state.predictions.filter(p => p.score >= .06).map(p => ({ ...p })),
    });
    state.phase = 'preparing';
    try {
      const prepared = await next(keywordPool);
      await sleep(Math.max(0, earliestCut - performance.now()));
      await cut(prepared);
      keywordPool = [];
      keywordOrigins.clear();
    } catch (error) {
      report(error);
      state.phase = 'retrying';
      await sleep(5000);
    }
  }
}
run().catch(error => { report(error); status.hidden = false; status.textContent = 'Impossibile avviare Spiral. Ricarica per riprovare.'; });
