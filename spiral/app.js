import { candidates, resolveItem, metadataMatches, videoTerms, videoCandidates } from './archive.js';
import { MIN_VIDEO_SECONDS, MAX_VIDEO_BYTES, MAX_SHOT_SECONDS } from './config.js';
import { setupInfo } from './info.js';
import { setupWords } from './words.js';
import { chooseBeforeDeadline } from './shot.js';

const videos = [...document.querySelectorAll('video')];
const status = document.querySelector('#status');
const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const context = canvas.getContext('2d', { willReadFrequently: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const recent = [];
const keywordOrigins = new Map();
let current = -1;
let worker;
let requestId = 0;
let visionRetryAt = 0;
let sound = false;
let fullscreenAttempted = false;
let reserve;
let analysisJob;
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

function waitMedia(video, event, action, timeout = 25000, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, success);
      video.removeEventListener('error', failure);
      signal?.removeEventListener('abort', abort);
    };
    const success = () => { cleanup(); resolve(); };
    const failure = () => { cleanup(); reject(new Error(`Media ${video.error?.code || 'error'}`)); };
    const abort = () => { cleanup(); reject(signal.reason || new Error('Cancelled')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Media timeout: ${event}`)); }, timeout);
    video.addEventListener(event, success, { once: true });
    video.addEventListener('error', failure, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
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

async function downloadVideo(url, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([controller.signal, signal]) : controller.signal });
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

async function prepare(item, signal) {
  const video = document.createElement('video');
  video.playsInline = true;
  video.loop = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  video.muted = true;
  for (const url of item.urls) {
    try {
      // Fully local playback: waiting on Archive can never stall the active film.
      signal?.throwIfAborted();
      video.dataset.blob = await downloadVideo(url, signal);
      await waitMedia(video, 'loadedmetadata', () => { video.src = video.dataset.blob; video.load(); }, 25000, signal);
      if (!Number.isFinite(video.duration) || video.duration < MIN_VIDEO_SECONDS) throw new Error(`Video shorter than ${MIN_VIDEO_SECONDS} seconds`);
      // Leave enough footage ahead, avoiding a title-card bias at t=0.
      const start = Math.random() * Math.max(0, video.duration - MAX_SHOT_SECONDS);
      await waitMedia(video, 'seeked', () => { video.currentTime = Math.max(.05, start); }, 25000, signal);
      if (video.readyState < 3) await waitMedia(video, 'canplay', undefined, 25000, signal);
      const filename = new URL(url, location.href).searchParams.get('file');
      return { item: { ...item, filename }, video, start: video.currentTime };
    } catch (error) {
      release(video);
      if (signal?.aborted) throw error;
      report(error);
    }
  }
  throw new Error(`Cannot play ${item.id}`);
}

async function next(terms = [], signal, excluded = [], random = false) {
  const initial = current < 0 || random;
  const selection = {
    from: state.current?.title || null,
    objects: state.predictions.filter(p => p.score >= .06).slice(0, 3).map(p => ({ ...p })),
    terms: [...terms], attempts: [], query: null, mode: null,
  };
  if (!random) state.search = selection;
  for (const term of initial ? [''] : terms) {
    signal?.throwIfAborted();
    if (!random) state.query = term || '(random)';
    const attempt = { query: term || '(random)', field: '', status: 'Ricerca in tutto Archive…', count: null, total: null };
    selection.attempts.push(attempt);
    try {
      const found = initial ? { items: await candidates('', '', true, signal), total: null } : await videoCandidates(term, signal);
      signal?.throwIfAborted();
      attempt.count = found.items.length;
      attempt.total = found.total;
      attempt.status = found.items.length ? 'Verifica dei primi risultati…' : 'Nessun risultato';
      const usable = found.items.filter(item => !recent.includes(item.identifier) && !(random && state.history.some(entry => entry.id === item.identifier)) && !excluded.includes(item.identifier));
      const resolved = [];
      for (let offset = 0; offset < usable.length; offset += 5) {
        signal?.throwIfAborted();
        const batch = await Promise.allSettled(usable.slice(offset, offset + 5).map(item => resolveItem(item, signal)));
        signal?.throwIfAborted();
        for (const result of batch) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          const item = result.value;
          const matches = term ? metadataMatches(item.searchMetadata, term) : [];
          if ((!term || matches.length) && (!initial || item.bytes <= 12 * 1024 * 1024)) resolved.push({ item, matches });
        }
      }
      const priority = { title: 0, description: 1, subject: 2 };
      resolved.sort((a, b) => (priority[a.matches[0]?.key] ?? 3) - (priority[b.matches[0]?.key] ?? 3)
        || a.item.bytes - b.item.bytes);
      for (const { item, matches } of resolved) {
        signal?.throwIfAborted();
        try {
          attempt.status = 'Corrispondenza verificata · download…';
          const prepared = await prepare(item, signal);
          if (initial && prepared.video.duration < 30) { release(prepared.video); continue; }
          signal?.throwIfAborted();
          attempt.status = 'Video pronto';
          const origin = keywordOrigins.get(term);
          Object.assign(selection, {
            query: term || null, mode: term ? 'visual' : random ? 'fallback' : 'initial', success: Boolean(term),
            field: matches[0]?.key || '', to: prepared.item.title, matches,
            objects: origin?.objects || selection.objects, from: origin?.from || selection.from,
            status: term ? 'Collegamento verificato: video pronto' : 'Video iniziale / riserva pronto',
          });
          return { ...prepared, selection: structuredClone(selection) };
        } catch (error) { if (signal?.aborted) throw error; report(error); }
      }
      attempt.status = found.items.length ? 'Nessun MP4 verificato e compatibile nei primi risultati' : 'Nessun risultato';
    } catch (error) {
      if (signal?.aborted) throw error;
      attempt.status = 'Errore archivio'; report(error);
    }
  }
  selection.status = 'Nessun correlato pronto: al limite di 120 secondi userò la riserva già caricata.';
  throw new Error(initial ? 'No playable candidate found' : selection.status);
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
  const slot = current === 0 ? 1 : 0;
  const incoming = prepared.video;
  const outgoing = videos[current];
  // Both play muted until incoming has actually decoded a frame.
  try {
    await incoming.play();
    // prepare() has already decoded the seeked frame from a complete local file.
    if (incoming.readyState < 3) await decodedFrame(incoming);
  } catch (error) {
    release(incoming);
    throw error;
  }
  if (videos[slot] !== incoming) {
    release(videos[slot]);
    videos[slot].replaceWith(incoming);
    videos[slot] = incoming;
  }
  incoming.classList.add('active');
  if (outgoing) {
    outgoing.muted = true; outgoing.pause(); outgoing.classList.remove('active');
    release(outgoing);
  }
  if (reserve?.video === incoming) reserve = null;
  incoming.muted = !sound;
  current = slot;
  state.shotStarted = performance.now();
  recent.push(prepared.item.id);
  if (recent.length > 40) recent.shift();
  state.current = prepared.item;
  state.selection = prepared.selection;
  state.phase = 'playing';
  state.predictions = [];
  state.analysis = null;
  state.search = null;
  state.query = '';
  state.lastError = null;
  state.history.push({ id: prepared.item.id, source: prepared.item.source, license: prepared.item.license, query: prepared.selection.query, selection: prepared.selection, start: prepared.start, at: new Date().toISOString() });
  if (state.history.length > 200) state.history.shift();
  status.hidden = true;
}

async function recognize() {
  state.phase = 'analyzing';
  const video = videos[current];
  const sourceItem = state.current;
  if (!video.videoWidth || video.readyState < 2) throw new Error('No frame to analyze');
  // Preserve the frame proportions; don't stretch archival 4:3 pictures.
  canvas.height = Math.max(1, Math.round(256 * video.videoHeight / video.videoWidth));
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const analysis = { image: canvas.toDataURL('image/jpeg', .8), title: state.current.title, time: video.currentTime };
  const predictions = await vision({ type: 'classify', pixels: frame.data.buffer, width: frame.width, height: frame.height }, [frame.data.buffer]);
  if (state.current !== sourceItem) return [];
  state.predictions = predictions;
  state.analysis = analysis;
  console.info('[spiral] frame', predictions);
  return videoTerms(predictions);
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
  const warmup = vision({ type: 'warmup' }).catch(report);
  // Start as soon as one film is ready. A fresh random reserve loads in parallel.
  while (current < 0) {
    try { await cut(await next()); }
    catch (error) { report(error); status.textContent = 'Archivio non disponibile. Riprovo…'; await sleep(3000); }
  }
  for (;;) {
    const deadline = state.shotDeadline = state.shotStarted + MAX_SHOT_SECONDS * 1000;
    const randomController = new AbortController();
    let randomJob;
    if (!reserve) {
      state.reserveStatus = 'Caricamento di un nuovo video casuale';
      randomJob = (async () => {
        while (!randomController.signal.aborted) {
          try {
            const fresh = await next([], randomController.signal, [state.current.id], true);
            if (randomController.signal.aborted) { release(fresh.video); return null; }
            reserve = fresh;
            state.reserveStatus = 'Nuovo video casuale pronto';
            return fresh;
          } catch (error) {
            if (randomController.signal.aborted) return null;
            state.reserveStatus = 'Archivio lento · nuovo tentativo';
            await sleep(2000);
          }
        }
      })();
    }
    const controller = new AbortController();
    const signal = controller.signal;
    const job = (async () => {
      await warmup;
      signal.throwIfAborted();
      while (!signal.aborted) {
      await sleep(1500);
      signal.throwIfAborted();
      if (analysisJob) await analysisJob.catch(() => {});
      signal.throwIfAborted();
      const ownAnalysis = recognize();
      analysisJob = ownAnalysis;
      let terms = [];
      try { terms = await ownAnalysis; }
      finally { if (analysisJob === ownAnalysis) analysisJob = null; }
      signal.throwIfAborted();
      for (const term of terms) keywordOrigins.set(term, {
        from: state.analysis.title, objects: state.predictions.filter(p => p.score >= .06).map(p => ({ ...p })),
      });
      state.phase = 'preparing';
      try { return await next(terms, signal); }
      catch (error) {
        if (signal.aborted) throw error;
        state.phase = 'retrying';
        await sleep(6000);
      }
      }
      return null;
    })().catch(error => { if (!signal.aborted) report(error); return null; });
    let prepared = await chooseBeforeDeadline(job, { deadline, controller });
    if (prepared) {
      await sleep(Math.max(0, state.shotStarted + Math.min(12000, Math.max(0, (videos[current].duration - videos[current].currentTime - 1) * 1000)) - performance.now()));
    } else {
      state.phase = 'retrying';
      // Prefer continuing the current film over revisiting a previous one.
      const fallback = reserve || await randomJob;
      if (!fallback) continue;
      prepared = { ...fallback, selection: {
        from: state.current.title, objects: [], terms: [], attempts: structuredClone(state.search?.attempts || []),
        query: null, mode: 'fallback', success: false, to: fallback.item.title, matches: [], field: '',
        status: 'Limite 120 secondi: nuovo video casuale, nessun collegamento visivo dichiarato',
      } };
    }
    if (!reserve) randomController.abort();
    try { await cut(prepared); }

    catch (error) { report(error); await sleep(1000); }
    keywordOrigins.clear();
  }
}

run().catch(error => { report(error); status.hidden = false; status.textContent = 'Impossibile avviare Spiral. Ricarica per riprovare.'; });
