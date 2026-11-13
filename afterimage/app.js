import { createSelectiveRecorder } from './recording/recorder.js';
import { resolveItem, queryFor, prefetchKeyword } from './archive.js';
import { UniformPool, CandidatePool, Semaphore } from './pool.js';
import { captionTerms } from './terms.js';
import { prepare, startPlaying, release, capture, captureItemFrame, pickScene, sceneFrame, waitFor, bufferAhead, MAX_PLAY_SECONDS, ios } from './media.js';
import { renderInfo, toggleInfo } from './info.js';
import { setWaiting, addLoadingImages, finishLoading, FADE_MS } from './loading.js';
import { showTitle, typeCaption, writeCaption, captionState, titleSeconds, underline, anchor, revealAfter, readEnough } from './subtitles.js';
import { exportChainPDF, exportChainExcel } from './exports.js';
import { historyState, hydrateFrames } from './history.js';
import { beginChain, describeChain, queryChain, finishChain, exportChain, download } from './history.js';
import { report } from './report.js';
import { archiveStats } from './archive-transport.js';

const stage = document.querySelector('#stage');
const skipArea = document.querySelector('#skipArea');
const favicon = document.querySelector('#favicon');
const slots = Array.from({ length: 13 }, () => {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous'; video.muted = true; video.preload = 'auto'; video.playsInline = true; video.loop = false;
  video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); stage.append(video);
  return { video, media: null, item: null, role: 'idle', kind: null, controller: null, claim: null };
});
const state = {
  step: 'query', modelStatus: 'loading…', caption: '', terms: [], query: queryFor([]),
  checked: 0, total: null, next: null, message: 'finding the first video…', downloadStatus: '',
  switches: 0, fallbacks: 0, muted: true, fitMode: 'fill', preview: '', frameTime: null, inferenceMs: null,
  paused:false,reviewing:false,reviewIndex:null,queueTarget:5,queueGeneral: 0, queueSemantic: 0, loading: 0, buffer: 0, elapsed: 0, prepareMs: null,
};
let pausedAt=0;
let active, switching = false, generation = 0, context;
const recording=createSelectiveRecorder({name:'afterimage',suspendPlayback:()=>{const was=state.paused;if(!was)togglePlaybackPause();return()=>{if(!was&&state.paused)togglePlaybackPause();};},getSnapshots:async()=>{await hydrateFrames();return historyState.records.filter(r=>r.shown!==false).map(r=>{const w=innerWidth,h=innerHeight,iw=r.frame?.width||r.video.width||4,ih=r.frame?.height||r.video.height||3,scale=state.fitMode==='fill'?Math.max(w/iw,h/ih):Math.min(w/iw,h/ih);return {preview:r.frame?.preview,source:{url:r.video.streamURL,archiveID:r.video.id,filename:r.video.filename},time:r.frame?.time??r.playStart??0,layout:{layers:[{source:{x:0,y:0,width:1,height:1},destination:{x:(w-iw*scale)/2,y:(h-ih*scale)/2,width:iw*scale,height:ih*scale}}]}};});},getScene:()=>{
 if(!active?.video||active.video.readyState<2||active.media?.readable===false)return null;
 const video=active.video,crop=active.crop||1;return {key:active.recordingKey||active.startedAt,video,muted:state.muted,paused:state.paused||document.hidden||video.paused||video.readyState<3,draw:(ctx,w,h)=>{
  ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);const ratio=state.fitMode==='fill'?Math.max(w/video.videoWidth,h/video.videoHeight)*crop:Math.min(w/video.videoWidth,h/video.videoHeight);
  ctx.drawImage(video,(w-video.videoWidth*ratio)/2,(h-video.videoHeight*ratio)/2,video.videoWidth*ratio,video.videoHeight*ratio);
 }};
}});


let worker, workerReady, rpcID = 0;
const pending = new Map(), recent = new Set(), failed = new Map();
const lifetime = new AbortController();
// iPhone: fewer simultaneous video downloads and decoders.
const network = new Semaphore(ios ? 2 : 3);
const generalPool = new UniformPool([], lifetime.signal, result => {
  addLoadingImages(result.items);
  if (!active) update({ query: result.query, total: result.total, message: 'looking for light video files…' });
}, { inflight: 5, target: 8, onItem: item => addLoadingImages([item]) });
const update = changes => {
  if (changes.message) report.message(changes.message);
  Object.assign(state, changes);
  if (!active && /archive.*(?:http|disponibile|rispond|raggiung)|backend_error|timeout|failed to fetch/i.test(changes.message || '')) document.querySelector('#info').hidden = false;
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
      const error = new Error('local model timeout');
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
    workerReady = rpc({ type: 'warmup' }).then(() => update({ modelStatus: 'ready · no remote API' })).catch(error => {
      workerReady = null; worker?.terminate(); worker = null;
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear();
      throw error;
    });
  }
  return workerReady;
}

// The recorder reads video pixels and audio, which only /cors/ streams allow.
const needPixels = () => ['starting', 'recording'].includes(recording.status.phase);
// Heavier files are acceptable where byte ranges avoid downloading from the start.
const fileLimits = ios ? { maxBitrate: 1500000, maxHeight: 720 } : { maxBitrate: 3000000, maxHeight: 1080 };
// Shortest time on screen before a ready successor takes over, and how long a
// video that ended early keeps its last frame while its successor is prepared.
const MIN_PLAY_SECONDS = 10, HOLD_MS = 10000;
// While its successor is still being found a video simply keeps playing (or
// replays its clip): a random video comes only after this long, or when the
// description has no keyword left.
const LONGEST_SECONDS = 120;
// Videos too short to leave time for finding the next one (title 10 s,
// description ~3.5 s, preparation of the successor) are skipped: they would
// end and loop. Shortest file, and shortest stretch left after the start point.
const MIN_VIDEO_SECONDS = 40, MIN_LEFT_SECONDS = 30;
let fallbackCause = '';
// A successor takes over only when it can play on without stalling: enough
// seconds already downloaded from its start (or all of its clip), or it has
// been waiting long enough that the browser has stopped buffering it.
const READY_SECONDS = ios ? 3 : 8, READY_PATIENCE_MS = 12000;
function prontissimo(slot) {
  if (!slot?.media) return false;
  const want = Math.min(READY_SECONDS, slot.media.seconds - .2);
  return bufferAhead(slot.video, slot.media.start) >= want || performance.now() - (slot.readyAt || 0) > READY_PATIENCE_MS;
}
// A keyword that already led somewhere recently goes after the fresh ones.
const usedTerms = [];
const freshFirst = terms => [...terms].sort((a, b) => Number(usedTerms.includes(a)) - Number(usedTerms.includes(b)));
async function describeFrame(frame) {
  await ensureModel();
  const { pixels, ...shown } = frame;
  const result = await rpc({ type: 'caption', pixels, width: frame.width, height: frame.height }, [pixels], 45000);
  return { frame: shown, bars: shown.bars, caption: result.caption, terms: result.terms?.length ? result.terms : captionTerms(result.caption), inferenceMs: result.inferenceMs };
}
// One description per video, started as early as its frame is known: for a
// scene thumbnail that is before the video has even buffered.
function visionOf(item, getFrame) {
  return item.vision ||= getFrame().then(describeFrame).then(vision => {
    item.bars = vision.bars;
    for (const slot of slots) if (slot.item?.id === item.id) { slot.bars = vision.bars; if (slot === active) applyCrop(slot); }
    return vision;
  }).catch(error => { item.vision = null; throw error; });
}
// Candidates of a keyword that keep failing must not hold the chain: move on.
function missed(cycle) {
  if (!cycle || cycle !== context || ++cycle.misses < 8 || !cycle.keywords.length) return;
  for (const slot of slots) if (slot !== active && slot.kind === 'semantic' && slot.role !== 'ready') slot.controller?.abort();
  cycle.pool = null; nextKeyword(cycle);
}
// Full-bleed: cover the screen, and enlarge further when the file itself
// carries black bars, until they fall outside the screen.
const OVERSCAN = 1.03;
function applyCrop(slot) {
  if (!slot?.video) return;
  const video = slot.video, bars = slot.bars;
  // Archive files often carry a few black pixels of blanking on the edges
  // (DV, digitised tape): a small fixed overscan hides them, like a TV set.
  let scale = state.fitMode === 'fill' ? OVERSCAN : 1;
  if (state.fitMode === 'fill' && bars && video.videoWidth) {
    const cover = Math.max(innerWidth / video.videoWidth, innerHeight / video.videoHeight);
    const visibleX = innerWidth / (video.videoWidth * cover), visibleY = innerHeight / (video.videoHeight * cover);
    scale = Math.min(1.6, Math.max(OVERSCAN, visibleX / (1 - 2 * bars.x), visibleY / (1 - 2 * bars.y)));
  }
  slot.crop = scale;
  video.style.transform = scale > 1.001 ? `scale(${scale.toFixed(4)})` : '';
}
addEventListener('resize', () => applyCrop(active));
function remember(id) {
  markPlayed(id);
  recent.add(id); if (recent.size > 128) recent.delete(recent.values().next().value);
}
const readySlots = kind => slots.filter(slot => slot.role === 'ready' && (!kind || slot.kind === kind));
// Never the same video twice, across sessions too.
const playedKey = 'afterimage-coverage:played:v1', played = new Set();
try { for (const id of JSON.parse(localStorage.getItem(playedKey) || '[]')) played.add(id); } catch {}
function markPlayed(id) {
  if (!id || played.has(id)) return; played.add(id);
  try { localStorage.setItem(playedKey, JSON.stringify([...played].slice(-20000))); } catch {}
}
function excluded(id) {
  return played.has(id) || recent.has(id) || (failed.get(id) || 0) > performance.now() || slots.some(slot => slot.claim === id);
}
function invalidateSemantic() {
  context?.controller.abort();
  for (const slot of slots) if (slot !== active && slot.kind === 'semantic') {
    slot.controller?.abort(); if (slot.role === 'ready') { release(slot); slot.claim = null; }
  }
}
function trimGeneral() {
  if(state.paused)return;
  const general = slots.filter(slot => slot !== active && slot.kind === 'general')
    .sort((a, b) => Number(b.role === 'ready') - Number(a.role === 'ready'));
  for (const slot of general.slice(2).filter(slot=>slot.role!=='ready')) {
    slot.controller?.abort();
  }
}
async function fill(slot, kind, cycle = context, keywordPool = cycle?.pool) {
  const token = slot.token = Symbol();
  const controller = slot.controller = new AbortController();
  const signal = kind === 'semantic' ? AbortSignal.any([controller.signal, cycle.controller.signal]) : controller.signal;
  const pool = kind === 'semantic' ? keywordPool : generalPool;
  slot.role = 'resolving'; slot.kind = kind;
  try {
    for (let attempts = 0; attempts < 6 && !signal.aborted; attempts++) {
      const entry = await abortable(pool.take(excluded), signal);
      if (!entry) {
        // This keyword has no candidate left and none on its way: try the next
        // keyword of the same description now instead of waiting on it.
        if (kind === 'semantic' && cycle === context && cycle.backup === pool) { cycle.backup = null; return; }
        if (kind === 'semantic' && cycle === context && cycle.pool === pool && !slots.some(s => s !== slot && s.kind === 'semantic' && ['buffering', 'ready'].includes(s.role))) { cycle.pool = null; nextKeyword(cycle); return; }
        await delay(1200, signal); continue;
      }
      slot.claim = entry.candidate.identifier;
      update({ checked: state.checked + 1 });
      try {
        const candidate = await resolveItem(entry.candidate, pool.terms, signal, fileLimits);
        if (!candidate || candidate.duration && candidate.duration < MIN_VIDEO_SECONDS) { if (candidate) report.short(); failed.set(slot.claim, performance.now() + 60000); slot.claim = null; if (kind === 'semantic') missed(cycle); continue; }
        slot.role = 'buffering';
        if (kind === 'semantic' || !active) update({ step: 'preloading', message: `preparing ${candidate.title}` });
        const began = performance.now();
        const middle = candidate.collections.includes('prelinger');
        // With a scene thumbnail the video starts on that scene through byte
        // ranges, and the model can describe it while the stream buffers.
        // The very first video starts from its beginning, the fastest point to reach.
        const scene = needPixels() || !active && !middle ? null : pickScene(candidate, { middle });
        const item = { ...candidate, scene };
        if (scene && kind === 'semantic') visionOf(item, () => sceneFrame(item, scene, lifetime.signal)).then(vision => {
          if (kind !== 'semantic' || cycle !== context || cycle.prefetched || !vision.terms.length) return;
          cycle.prefetched = true; prefetchKeyword([freshFirst(vision.terms)[0]]);
        }).catch(() => {});
        const bitrate = candidate.duration ? candidate.bytes * 8 / candidate.duration : 1000000;
        slot.media = await network.run(() => prepare(slot.video, candidate.streamURL, signal, { startup: !active, middle, startAt: scene ? scene.time : null, pixels: !scene, maxStart: 48000000 / bitrate }), signal, kind === 'semantic' ? 1 : 0);
        if (signal.aborted || kind === 'semantic' && cycle !== context) return;
        // The real length is known only now (Archive metadata can be missing or wrong).
        if (slot.video.duration - slot.media.start < MIN_LEFT_SECONDS) { report.short(); throw new Error('video too short'); }
        if (!scene && kind === 'semantic' && slot.media.readable) visionOf(item, async () => ({ ...capture(slot.video), source: 'fotogramma del lettore' })).catch(() => {});
        slot.item = { ...item, incoming: kind === 'semantic' ? {
          parentID: cycle.parent.id, parentTitle: cycle.parent.title, terms: [...pool.terms],
          caption: cycle.caption, keywords: cycle.allKeywords, frameTime: cycle.frameTime,
          query: entry.result.query, kind: 'query', backup: pool === cycle.backup,
        } : null };
        slot.role = 'ready'; slot.readyAt = performance.now();
        update({ prepareMs: performance.now() - began }); report.prepared(performance.now() - began);
        if (kind === 'semantic') update({ step: 'ready', next: slot.item, query: entry.result.query, message: 'linked successor ready' });
        if (!active && !switching && !state.paused) promote(slot, 'startup');
        return;
      } catch (error) {
        if (signal.aborted) return;
        failed.set(slot.claim, performance.now() + 60000);
        release(slot); slot.kind = kind; slot.role = 'resolving'; slot.claim = null;
        if (kind === 'semantic') missed(cycle);
        if (kind === 'semantic' || !active) update({ message: `${error.message}; trying another candidate…` });
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
  if(state.reviewing)return;
  // Retry an already buffered candidate after a failed start, without waiting
  // for another network search or preparation to finish.
  if(!active&&!switching&&!state.paused&&!document.hidden){const ready=readySlots('general')[0];if(ready)void promote(ready,'startup');}
  if (active) trimGeneral();
  // Many quick draws at startup; afterwards only what the reserve needs.
  // Random videos are only the last resort once the chain runs: a single one in reserve.
  generalPool.target = active && !state.paused ? 1 : 8; generalPool.inflight = active && !state.paused ? 1 : 5;
  if (needPixels()) for (const slot of slots) if (slot !== active && slot.role === 'ready' && slot.media?.readable === false) { release(slot); slot.claim = null; }
  const generalTarget = active ? (state.paused?9:1) : 4;
  // A stalled random search must never occupy every preparation lane.
  const semanticPreparing=slots.some(slot=>slot.kind==='semantic'&&['resolving','buffering'].includes(slot.role)&&!slot.controller?.signal.aborted);
  if(context?.pool&&!readySlots('semantic').length&&!semanticPreparing){
    const randomJobs=slots.filter(slot=>slot!==active&&slot.kind==='general'&&['resolving','buffering'].includes(slot.role)&&!slot.controller?.signal.aborted);
    if(randomJobs.length>=3){const job=randomJobs.find(slot=>slot.role==='resolving')||randomJobs.at(-1);job.controller.abort();}
  }
  let preparing=slots.filter(slot=>['resolving','buffering'].includes(slot.role)&&!slot.controller?.signal.aborted).length;
  let general = slots.filter(slot => slot !== active && slot.kind === 'general'&&!slot.controller?.signal.aborted).length;
  let semantic = slots.filter(slot => slot !== active && slot.kind === 'semantic'&&!slot.controller?.signal.aborted).length;
  for (const slot of slots) {
    if (preparing>=3)break;
    if (slot.role !== 'idle' || (slot.retryAt || 0) > performance.now()) continue;
    if (context?.pool && semantic < 2 && (slots.filter(s=>s.kind==='semantic'&&['resolving','buffering'].includes(s.role)&&!s.controller?.signal.aborted).length<2 || readySlots('general').length)) { semantic++; preparing++;
      // The second preparation goes to the backup keyword, if there is one.
      const onMain = slots.filter(s => s !== slot && s !== active && s.kind === 'semantic' && s.keywordPool === context.pool && !s.controller?.signal.aborted).length;
      const onBackup = slots.filter(s => s !== slot && s !== active && s.kind === 'semantic' && s.keywordPool === context.backup && !s.controller?.signal.aborted).length;
      // Only when the first keyword struggles (failed candidates, or nothing
      // ready after a while), to keep the number of searches low.
      const struggling = context.misses >= 2 || active && performance.now() - active.startedAt > 16000;
      slot.keywordPool = context.backup && struggling && onMain > onBackup ? context.backup : context.pool;
      fill(slot, 'semantic', context, slot.keywordPool); }
    else if (general < generalTarget) { general++; preparing++; fill(slot, 'general'); }
  }
  state.queueTarget=state.paused?12:5;
  state.queueGeneral = readySlots('general').length;
  state.queueSemantic = readySlots('semantic').length;
  state.loading = slots.filter(slot => ['resolving', 'buffering'].includes(slot.role)).length;
  skipArea.disabled = false;
}
async function analyze(cycle) {
  const signal = cycle.controller.signal, slot = active, item = active.item;
  for (let attempt = 0; attempt < 3 && cycle === context; attempt++) {
    try {
      update({ step: 'model', modelStatus: 'describing the frame…' });
      // Usually already under way (or done) since the video was a candidate.
      const vision = await abortable(visionOf(item, async () => {
        if (item.scene && attempt === 0) return sceneFrame(item, item.scene, signal);
        const settle = Math.min(600, slot.media.seconds * 120) - (performance.now() - slot.startedAt);
        if (settle > 0) await delay(settle, signal);
        await waitFor(() => !slot.video.seeking && slot.video.readyState >= 2, signal);
        return captureItemFrame(slot, signal);
      }), signal);
      if (cycle !== context || signal.aborted) return;
      // The single words of a compound tag stay as later attempts ("rain boot" → "boot").
      const words = vision.terms.flatMap(term => term.includes(' ') ? term.split(' ').filter(word => word.length > 3) : []);
      const frame = vision.frame, terms = [...new Set([...freshFirst(vision.terms), ...freshFirst(words)])];
      favicon.href = frame.preview; cycle.frameTime = frame.time;
      cycle.caption = vision.caption; cycle.keywords = [...terms]; cycle.allKeywords = [...terms];
      describeChain(vision.caption, terms, { time: frame.time, source: frame.source, preview: frame.preview, width: frame.width, height: frame.height });
      typeCaption(vision.caption, terms[0]); report.caption(vision.caption, vision.inferenceMs);
      update({ step: 'keyword', preview: frame.preview, frameTime: frame.time, frameSource: frame.source, caption: vision.caption, terms, inferenceMs: vision.inferenceMs, modelStatus: 'ready · local inference' });
      if (!terms.length) { item.vision = null; await delay(4000, signal); continue; }
      nextKeyword(cycle); return;
    } catch (error) {
      if (signal.aborted || cycle !== context) return;
      item.vision = null;
      report.visionFailed(error.message); update({ message: error.message }); await delay(2500, signal).catch(() => {});
    }
  }
  if (cycle === context) cycle.dead = true;
}
// One search per keyword and description, shared by every slot that needs it.
function keywordPool(cycle, term) {
  let pool = cycle.pools.get(term);
  if (!pool) cycle.pools.set(term, pool = new CandidatePool([term], cycle.controller.signal, result => {
    if (cycle !== context) return;
    queryChain(term, result.query, result.total);
    if (pool === cycle.pool) update({ step: 'query', query: result.query, total: result.total, selectedTerm: term });
    if (result.total) return;
    if (!pool.empty) report.emptyKeyword(term);
    pool.empty = true;
    if (pool === cycle.backup) { cycle.backup = null; return; }
    // An empty query moves to another literal keyword without re-running vision.
    if (pool === cycle.pool) setTimeout(() => {
      if (cycle === context && cycle.pool === pool && !cycle.controller.signal.aborted) {
        for (const slot of slots) if (slot !== active && slot.kind === 'semantic' && slot.role !== 'ready') slot.controller?.abort();
        cycle.pool = null; nextKeyword(cycle);
      }
    }, 150);
  }));
  return pool;
}
// The chosen keyword and, side by side, the next one as a backup: if the first
// gives nothing playable in time, the second is already being prepared.
function nextKeyword(cycle) {
  cycle.pools ||= new Map();
  let term;
  do term = cycle.keywords.shift(); while (term && cycle.pools.get(term)?.empty);
  if (!term) { cycle.dead = true; cycle.pool = cycle.backup = null; return; }
  cycle.misses = 0;
  usedTerms.push(term); if (usedTerms.length > 40) usedTerms.shift();
  cycle.pool = keywordPool(cycle, term);
  const spare = cycle.keywords.find(t => !cycle.pools.get(t)?.empty);
  cycle.backup = spare ? keywordPool(cycle, spare) : null;
  queryChain(term, queryFor([term]));
  underline(term);
  update({ step: 'query', query: queryFor([term]), selectedTerm: term, total: null }); pump();
}
// The sound of the first video rises together with the picture fading in
// (iOS ignores volume: there it simply starts with the video).
function fadeInSound(slot) {
  const video = slot.video, started = performance.now();
  video.volume = 0;
  const step = () => {
    const k = Math.min(1, (performance.now() - started) / FADE_MS);
    if (active && active !== slot || k >= 1) { video.volume = 1; return; }
    video.volume = k; requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
async function promote(next, reason) {
  if (state.paused || switching || next.role !== 'ready') return;
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
    recording.sample();if (old) finishChain(next.item, reason);
    beginChain(next.item, reason, next.media.start);
    next.video.classList.toggle('fill', state.fitMode === 'fill'); next.bars = next.item.bars || next.bars; applyCrop(next);
    next.video.classList.add('on'); old?.video.classList.remove('on');
    // Title first; for a keyword successor the shared word sits where it was in the description.
    const keyword = next.kind === 'semantic' ? next.item.incoming?.terms?.[0] || '' : '';
    if (old?.stallAt) { report.stall(performance.now() - old.stallAt); old.stallAt = 0; }
    report.video(next.item, reason, { keyword, cause: reason === 'fallback' ? fallbackCause : '' });
    if (next.item.incoming?.backup) report.backup();
    // The first video fades in from white; its subtitles wait until it is fully visible.
    const reveal = setWaiting(false);
    if (reveal) { revealAfter(reveal); fadeInSound(next); }
    if (keyword) underline(keyword);
    showTitle(next.item.title, { keyword, anchorX: keyword ? anchor() : null, newSession: !!old && next.kind !== 'semantic' });
    active = next; active.role = 'active'; active.startedAt = performance.now();active.recordingKey=Symbol();if(state.paused){pausedAt=performance.now();active.video.pause();}
    active.lastTime = next.video.currentTime; active.lastProgress = performance.now();
    invalidateSemantic();
    remember(next.item.id);
    update({ switches: state.switches + Number(!!old), fallbacks: state.fallbacks + Number(!!old && next.kind !== 'semantic'),
      step: 'model', caption: '', terms: [], selectedTerm: '', query: '', total: null, next: null, preview: '', frameTime: null, inferenceMs: null, message: 'describing the current video…' });
    if (old) { release(old); old.claim = null; }
    context = { id: ++generation, parent: next.item, controller: new AbortController(), pool: null, keywords: [], misses: 0 };
    analyze(context); await reveal;
  } catch (error) {
    release(next); next.claim = null; update({ message: error.message });
  } finally { switching = false; pump(); }
}
function tick() {
  if(state.paused){requestAnimationFrame(tick);return;}
  if(state.reviewing){if(active&&performance.now()-active.startedAt>=MAX_PLAY_SECONDS*1000)active.video.pause();requestAnimationFrame(tick);return;}
  // Enforce the cap even while the next decoder is starting asynchronously.
  if (active && !document.hidden && performance.now() - active.startedAt >= LONGEST_SECONDS * 1000) active.video.pause();
  if (active && !switching && !document.hidden) {
    const video = active.video, now = performance.now();
    const elapsed = (now - active.startedAt) / 1000;
    const semantic = readySlots('semantic')[0], general = readySlots('general')[0];
    if (Math.abs(video.currentTime - active.lastTime) > .02) {
      active.lastTime = video.currentTime; active.lastProgress = now;
    }
    const stalled = !video.paused && now - active.lastProgress > 2200;
    // The clip of a scene is only where playback starts: the video goes on
    // past it while the successor is prepared, until the file really ends.
    const ended = video.ended || video.duration - video.currentTime < .2;
    const over = elapsed >= MAX_PLAY_SECONDS, tooLong = elapsed >= LONGEST_SECONDS;
    const chainAlive = context && !context.dead;
    if (!stalled) active.heldAt = 0; else active.heldAt ||= now;
    // Never before the subtitles have been read: the title for at least 3 s and
    // the finished description for at least 2 s.
    const read = readEnough();
    // Interruptions the audience sees (the video stopped while loading), for the report.
    if (stalled && !active.stallAt) active.stallAt = active.lastProgress;
    else if (!stalled && active.stallAt) { report.stall(now - active.stallAt); active.stallAt = 0; }
    if (over && !active.extended) { active.extended = true; report.extended(); }
    // The successor takes over once well buffered (after MIN_PLAY_SECONDS),
    // or at once when the current video stalls. A random video only when the
    // chain cannot go on: no keyword left, a stall that lasts, or the very
    // long limit.
    // The title counts from when it appears (after the first fade-in, not before).
    const next = semantic && (Math.min(elapsed, titleSeconds(now)) >= MIN_PLAY_SECONDS && prontissimo(semantic) || stalled || tooLong) ? semantic
      : general && (tooLong || !chainAlive && (over || ended) || stalled && now - active.heldAt > HOLD_MS) ? general : null;
    if (next) {
      // Until now only the title was on screen: the description is written
      // now, left for 2 s, and then the video changes.
      if (captionState() === 'waiting') writeCaption();
      if (read) {
        if (next === general) fallbackCause = tooLong ? 'nessun successore dopo 2 minuti' : !chainAlive ? 'parole della descrizione esaurite' : 'video bloccato più di 10 s';
        promote(next, next === semantic ? 'query' : 'fallback');
      }
    }
    // A short video that ends while the chain is still searching plays its clip again.
    if (ended && !tooLong && !(next && read)) { report.replay(); video.currentTime = active.media.start; video.play().catch(() => {}); active.lastProgress = now; }
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
  if(event.target.closest('#info'))return;
  if (firstClick) {
    firstClick = false;
    state.muted = false;
    // Unlock audio inside the first user gesture, even during loading.
    for (const { video } of slots) video.muted = false;recording.syncAudioMonitor();
    if (!state.paused && active && !active.video.ended && state.elapsed < LONGEST_SECONDS) active.video.play().catch(() => {});
    renderInfo(state, active);
    return;
  }
  if (event.target.closest('#info')) return;
  skipReady();
});
function togglePlaybackPause(){
 state.paused=!state.paused;const now=performance.now();
 if(state.paused){pausedAt=now;active?.video.pause();report.pause();}
 else if(active){active.startedAt+=now-pausedAt;active.lastProgress=now;if(!document.hidden&&!active.video.ended&&state.elapsed<LONGEST_SECONDS)active.video.play().catch(()=>{});}
 else{const next=readySlots('general')[0];if(next)promote(next,'startup');}
 recording.sample();pump();renderInfo(state,active);
}
document.addEventListener('keydown', event => {
  if(event.key===' '&&!event.target.closest('input,textarea,select,button,[contenteditable="true"]')){event.preventDefault();if(!event.repeat)togglePlaybackPause();return;}
  if(event.target.matches('input,textarea,select'))return;
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (['i', 'm', 'f', 'c', 's', 'p', '1', 'arrowright', 'arrowleft'].includes(key)) {
    event.preventDefault();
    if (document.activeElement === skipArea) skipArea.blur();
  }
  if (key === 'arrowright') { event.preventDefault(); state.reviewing?navigateHistory(1):skipReady(); }
  if(key==='arrowleft')navigateHistory(-1);
  if(key==='p')exportChainPDF().catch(error=>update({message:error.message}));

  if (key === 'c' || key === 'i') { toggleInfo(); renderInfo(state, active); }
  if (key === 'm') { state.muted = !state.muted; if (active) active.video.muted = state.muted; recording.syncAudioMonitor(); renderInfo(state, active); }
  if (key === 'f') {
    const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    action.catch(error => update({ message: error.message }));
  }
  if (key === 's') exportChain();
  // 1: a plain-text report of this session (interruptions, timings, every video).
  if (key === '1') downloadReport();
});
window.addEventListener('afterimage:fit',()=>{if(!active)return;const fill=active.video.classList.toggle('fill');update({fitMode:fill?'fill':'fit'});applyCrop(active);});
async function navigateHistory(delta){
 if(switching||!active)return;
 const records=historyState.records,index=(state.reviewIndex??records.length-1)+delta;
 if(index<0)return;
 if(index>=records.length){state.reviewing=false;state.reviewIndex=null;context={id:++generation,parent:active.item,controller:new AbortController(),pool:null,caption:state.caption,keywords:[...state.terms],allKeywords:[...state.terms],misses:0};if(state.caption&&state.terms.length)nextKeyword(context);else analyze(context);pump();return;}
 switching=true;context?.controller.abort();state.reviewing=true;
 for(const slot of slots)if(slot!==active){slot.controller?.abort();if(slot.role==='ready'){release(slot);slot.claim=null;}}
 const old=active;let target;
 try{
  const record=records[index];await hydrateFrames([record]);target=slots.find(slot=>slot!==old&&slot.role==='idle');if(!target)throw Error('waiting for a free slot for the history');
  target.role='buffering';target.item=record.video.streamURL?{...record.video,streamURL:record.video.streamURL.replace('/download/','/cors/')} : await resolveItem({identifier:record.video.id},[],new AbortController().signal);
  if(!target.item)throw Error('history video unavailable');
  target.media=await prepare(target.video,target.item.streamURL,new AbortController().signal,{startup:true,startAt:record.playStart||0,pixels:needPixels()});await startPlaying(target.video);target.video.muted=state.muted;target.video.classList.toggle('fill',state.fitMode==='fill');target.video.classList.add('on');old.video.classList.remove('on');active=target;active.role='active';active.startedAt=performance.now();active.recordingKey=Symbol();if(state.paused){pausedAt=performance.now();active.video.pause();}release(old);old.claim=null;
  showTitle(record.video.title);update({reviewIndex:index,step:'history',caption:record.description,terms:record.keywords||[],preview:record.frame?.preview||'',message:'history · → goes on; after the last video the flow resumes'});
 }catch(error){if(target&&target!==active)release(target);update({message:error.message});}finally{switching=false;}
}
window.addEventListener('afterimage:navigate',event=>{if(event.detail<0||state.reviewing)navigateHistory(event.detail);else skipReady();});
function downloadReport() {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  download(new Blob([report.text({ archive: archiveStats() })], { type: 'text/plain;charset=utf-8' }), `afterimage_report_${stamp}.txt`);
}
window.addEventListener('afterimage:report', downloadReport);
window.addEventListener('afterimage:info', () => renderInfo(state, active));
window.addEventListener('afterimage:export-error',event=>update({message:event.detail}));
window.addEventListener('afterimage:filters',()=>{
 invalidateSemantic();for(const slot of slots)if(slot!==active){slot.controller?.abort();if(slot.role==='ready'){release(slot);slot.claim=null;}}generalPool.queue.length=0;failed.clear();
 if(active&&!state.reviewing){context={id:++generation,parent:active.item,controller:new AbortController(),pool:null,caption:state.caption,keywords:[...new Set([state.selectedTerm,...state.terms].filter(Boolean))],allKeywords:[...state.terms],misses:0};if(state.caption&&context.keywords.length)nextKeyword(context);else analyze(context);}pump();renderInfo(state,active);
});
document.addEventListener('visibilitychange', () => {
  report.visibility(document.hidden);
  if (document.hidden) { active?.video.pause(); if (active) active.hiddenAt = performance.now(); }
  else if (active) {
    if(!state.paused)active.startedAt += performance.now() - (active.hiddenAt || performance.now());
    active.lastProgress = performance.now(); if(!state.paused)active.video.play().catch(() => {});
  }
});
setInterval(() => { pump(); renderInfo(state, active); }, 300);
requestAnimationFrame(tick);
// The first stream gets the connection first; analyze() starts the model once
// a video is playing, independently from future random/semantic reserves.
pump();

Object.defineProperty(window,'afterimageStatus',{get:()=>({...state,recordCount:historyState.records.length,activeID:active?.item?.id,switching,recording:recording.status})});
