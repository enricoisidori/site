import { primeCatalog, catalogCandidates, catalogRecord } from './catalog.js?v=runtime-51';
import { contentKey, bufferedAhead } from './media-ready.js?v=runtime-51';
import { decideCut } from './clip-queue.js?v=runtime-51';
import { createSeenVideos } from './seen.js?v=runtime-51';
import { candidates, resolveItem, sceneFrame, metadataMatches, videoTerms, videoCandidates, shuffle } from './archive.js?v=runtime-51';
import { MIN_VIDEO_SECONDS, MAX_VIDEO_BYTES, MAX_SHOT_SECONDS, LIMITED_ARCHIVE, DARKROOM } from './config.js?v=runtime-51';
import { setupInfo } from './info.js?v=runtime-51';
import { setupWords } from './words.js?v=runtime-51';

import { setupLoading } from './loading.js?v=runtime-51';

const videos = [...document.querySelectorAll('video')];
const status = document.querySelector('#status');
const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const context = canvas.getContext('2d', { willReadFrequently: true });
const launchStarted=performance.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let historyStorage;
try { historyStorage = window.localStorage; } catch {}
const seenVideos = createSeenVideos(historyStorage);
const keywordOrigins = new Map();
const searchPages = new Map();
const queryUses = new Map();
const rejectedUntil=new Map();
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
setupLoading(state);

function report(error) {
  state.lastError = String(error?.message || error);
  console.warn('[spiral]', state.lastError);
}

async function vision(message, transfer = []) {
  if (Date.now() < visionRetryAt) return Promise.reject(new Error('Vision temporarily unavailable'));
  worker ||= new Worker(new URL('./vision-worker.js?v=runtime-51', import.meta.url), { type: 'module' });
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
      if (data.id === id) {
        if (data.model) state.model = data.model;
        if (data.inferenceMs != null) state.inferenceMs = data.inferenceMs;
        if (data.caption !== undefined) state.caption = data.caption;
        finish(data.error ? new Error(data.error) : null, data.predictions || []);
      }
    };
    const onError = error => finish(new Error(error.message || 'Vision worker failed'));
    const timer = setTimeout(() => finish(new Error('Vision timeout')), message.type === 'warmup' ? 240000 : 20000);
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
  if(video.dataset.preparing) video.remove();
  video.classList.remove('active');
  video.removeAttribute('src');
  video.load();
  if(video.dataset.blob) { URL.revokeObjectURL(video.dataset.blob); delete video.dataset.blob; }
}

async function prepare(item, signal) {
  const video=document.createElement('video');
  video.playsInline=true; video.loop=false; video.preload='auto'; video.muted=true;
  video.setAttribute('aria-hidden','true'); video.dataset.preparing='true';
  for(const [index,source] of item.urls.entries()) {
    try {
      if(!video.isConnected) document.querySelector('main').append(video);
      const hash=item.contentHashes?.[index] || null;
      if(hash && seenVideos.has(contentKey(hash))) throw new Error('File già incontrato');
      const url=source.replace('/cors/','/download/');
      await waitMedia(video,'loadedmetadata',()=>{video.src=url;video.load();},12000,signal);
      if(!Number.isFinite(video.duration) || video.duration<MIN_VIDEO_SECONDS) throw new Error('Video troppo breve');
      const start=current<0 ? 0 : Math.random()*Math.max(0,video.duration-75);
      if(start>.1) await waitMedia(video,'seeked',()=>{video.currentTime=start;},8000,signal);
      await waitMedia(video,'playing',()=>{video.play().catch(()=>{});},5000,signal);
      const until=performance.now()+10000;
      while(bufferedAhead(video)<Math.min(current<0 ? 2 : 8,video.duration-video.currentTime-.2)) {
        signal?.throwIfAborted();
        if(video.error) throw new Error(`Media ${video.error.code}`);
        if(performance.now()>until) {
          if(video.readyState>=3 && bufferedAhead(video)>=2) break;
          throw new Error('Buffer insufficiente: provo un altro file');
        }
        await sleep(100);
      }
      video.pause();
      return {item:{...item,playback:'streaming diretto · buffer verificato',filename:decodeURIComponent(new URL(url,location.href).pathname.split('/').pop()),contentHash:hash},video,start:video.currentTime};
    } catch(error) {
      release(video);
      if(signal?.aborted) throw error;
      report(error);
    }
  }
  throw new Error(`Cannot play ${item.id}`);
}

async function next(terms = [], signal, excluded = [], random = false) {
  const initial = current < 0 || random;
  const selection = {
    from: state.current?.title || null,
    objects: state.predictions.filter(p => (p.score == null || p.score >= .06)).slice(0, 3).map(p => ({ ...p })),
    terms: [...terms], attempts: [], query: null, mode: null,
  };
  if (!random) state.search = selection;
  const orderedTerms = [...terms].sort((a,b)=>(queryUses.get(a)||0)-(queryUses.get(b)||0));
  for (const term of initial ? [''] : orderedTerms.slice(0,1)) {
    if(term) for(const word of orderedTerms) queryUses.set(word,(queryUses.get(word)||0)+1);
    signal?.throwIfAborted();
    if (!random) state.query = term ? orderedTerms.join(' / ') : '(random)';
    const attempt = { query: term ? orderedTerms.join(' / ') : '(random)', field: '', status: LIMITED_ARCHIVE ? 'Ricerca nelle collezioni…' : 'Ricerca in tutto Archive…', count: null, total: null };
    selection.attempts.push(attempt);
    try {
      let found;
      const cached=initial && current<0 ? catalogCandidates(id=>catalogRecord(id).files.some(f=>Number(f.length)>=45 && Number(f.size)<=MAX_VIDEO_BYTES) && !seenVideos.has(id) && !excluded.includes(id) && (rejectedUntil.get(id)||0)<Date.now()) : [];
      if (cached.length) found={items:cached,total:null};
      else if (initial) found = DARKROOM ? await videoCandidates('', signal, 1+Math.floor(Math.random()*5)) : { items: await candidates('', '', !LIMITED_ARCHIVE, signal), total: null };
      else {
        // Move through results instead of repeatedly requesting the same first 20.
        for (let scan = 0; scan < 2; scan++) {
          const page = searchPages.get(term) || 1;
          found = await videoCandidates(orderedTerms, signal, page, true);
          if(!found.total) found=await videoCandidates(orderedTerms,signal,page);
          searchPages.set(term, page * 6 >= found.total ? 1 : page + 1);
          if (found.items.some(item => !seenVideos.has(item.identifier) && !excluded.includes(item.identifier)) || !found.total) break;
        }
      }
      signal?.throwIfAborted();
      if(random) state.fallbackDetail=`${found.items.length} candidati casuali · verifica metadati`;
      attempt.count = found.items.length;
      attempt.total = found.total;
      attempt.status = found.items.length ? 'Verifica dei primi risultati…' : 'Nessun risultato';
      if(current<0) found.items=found.items.filter(item=>!catalogRecord(item.identifier) || catalogRecord(item.identifier).files.some(f=>Number(f.length)>=45));
      if(current<0) found.items.sort((a,b)=>(catalogRecord(a.identifier)?.files[0]?.size || Infinity)-(catalogRecord(b.identifier)?.files[0]?.size || Infinity));
      const usable = found.items.filter(item => !seenVideos.has(item.identifier) && !excluded.includes(item.identifier) && (rejectedUntil.get(item.identifier)||0)<Date.now());
      const resolved = [];
      for (let offset = 0; offset < Math.min(usable.length, 4); offset += 2) {
        signal?.throwIfAborted();
        const batch = await Promise.allSettled(usable.slice(offset, offset + 2).map(item => resolveItem(item, signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000))));
        signal?.throwIfAborted();
        if(random && batch.every(result=>result.status==='rejected')) report(new Error(`Metadati Archive: ${batch[0].reason?.message || 'non disponibili'}`));
        for (const result of batch) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          const item = result.value;
          const priority={title:0,description:1,subject:2};
          const matches = term ? orderedTerms.flatMap(word=>metadataMatches(item.searchMetadata,word).map(match=>({...match,query:word}))).sort((a,b)=>priority[a.key]-priority[b.key]) : [];
          if ((!term || matches.length) && item.bytes <= (MAX_VIDEO_BYTES)) resolved.push({ item, matches });
        }
        if (resolved.some(candidate => !term || candidate.matches[0]?.key === 'title') || (offset>=2 && resolved.length)) break;
      }
      const priority = { title: 0, description: 1, subject: 2 };
      resolved.sort((a, b) => (priority[a.matches[0]?.key] ?? 3) - (priority[b.matches[0]?.key] ?? 3)
        || a.item.bytes - b.item.bytes);
      for (const { item, matches } of resolved.slice(0, 2)) {
        signal?.throwIfAborted();
        let prepared;
        try {
          attempt.status = 'Corrispondenza verificata · precaricamento…';
          if(random) state.fallbackDetail=`Download leggero: ${item.title} · ${(item.bytes/1048576).toFixed(1)} MB`;
          prepared = await prepare(item, signal);
          signal?.throwIfAborted();
          if (seenVideos.has(item.id)) { release(prepared.video); continue; }
          attempt.status = 'Video pronto';
          const matchedTerm=matches[0]?.query || term;
          const origin = keywordOrigins.get(matchedTerm);
          Object.assign(selection, {
            query: matchedTerm || null, mode: term ? 'visual' : random ? 'fallback' : 'initial', success: Boolean(term),
            field: matches[0]?.key || '', to: prepared.item.title, matches,
            objects: origin?.objects || selection.objects, from: origin?.from || selection.from,
            status: term ? 'Collegamento verificato: video pronto' : 'Video iniziale / riserva pronto',
          });
          return { ...prepared, selection: structuredClone(selection) };
        } catch (error) { if(prepared) release(prepared.video); rejectedUntil.set(item.id,Date.now()+15*60000); if (signal?.aborted) throw error; report(error); }
      }
      attempt.status = found.items.length ? 'Nessun MP4 verificato e compatibile nei primi risultati' : 'Nessun risultato';
    } catch (error) {
      if (signal?.aborted) throw error;
      attempt.status = 'Errore archivio'; report(error);
    }
  }
  selection.status = 'Ricerca correlata ancora in corso: preparo una nuova riserva casuale.';
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
  if (!(await seenVideos.claim(prepared.item.contentHash ? [prepared.item.id, contentKey(prepared.item.contentHash)] : prepared.item.id))) {
    release(prepared.video || videos[prepared.slot]);
    throw new Error('Video già incontrato: scartato per mantenere la deriva.');
  }
  const slot = current === 0 ? 1 : 0;
  const incoming = prepared.video;
  const outgoing = videos[current];
  // Both play muted until incoming has actually decoded a frame.
  try {
    await waitMedia(incoming,'playing',()=>{incoming.play().catch(report);},5000);
    // Keep the outgoing video visible until the incoming player is ready.
    if (incoming.readyState < 3) await decodedFrame(incoming);
  } catch (error) {
    release(incoming);
    throw error;
  }
  if (videos[slot] !== incoming) {
    release(videos[slot]);
    // Moving a native media element restarts its stream in WebKit.
    // A preloaded connected element must stay in its original DOM position.
    if(incoming.isConnected) videos[slot].remove();
    else videos[slot].replaceWith(incoming);
    videos[slot] = incoming;
  }
  delete incoming.dataset.preparing;
  incoming.classList.add('active');
  if (outgoing) {
    outgoing.muted = true; outgoing.pause(); outgoing.classList.remove('active');
    release(outgoing);
  }
  incoming.muted = !sound;
  current = slot;
  if(!state.history.length) state.startupMs=performance.now()-launchStarted;
  state.shotStarted = performance.now();
  state.current = prepared.item;
  state.selection = prepared.selection;
  state.phase = prepared.selection.mode !== 'visual' && state.search ? 'preparing' : 'playing';
  state.relatedCount = (state.relatedCount || 0) + Number(prepared.selection.mode === 'visual');
  state.randomCount = (state.randomCount || 0) + Number(prepared.selection.mode === 'fallback');
  // Each cut starts an independent analysis of the incoming video.
  state.search=null; state.query=''; state.predictions=[]; state.analysis=null; state.caption='';
  keywordOrigins.clear(); state.fallbackDetail='';
  state.lastError = null;
  state.history.push({ id: prepared.item.id, source: prepared.item.source, license: prepared.item.license, query: prepared.selection.query, selection: prepared.selection, start: prepared.start, at: new Date().toISOString() });
  if (state.history.length > 200) state.history.shift();
  status.hidden = true;
}

async function recognize() {
  state.phase='analyzing';
  const item=state.current;
  const still=await sceneFrame(item,videos[current].currentTime,AbortSignal.timeout(10000));
  const image=new Image(); image.crossOrigin='anonymous';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try {
    await new Promise((resolve,reject)=>{
      image.onload=resolve; image.onerror=()=>reject(new Error('Fotogramma Archive non disponibile'));
      controller.signal.addEventListener('abort',()=>{image.src='';reject(new Error('Timeout fotogramma'));},{once:true});
      image.src=still.url;
    });
  } finally {clearTimeout(timer);}
  canvas.height=Math.max(1,Math.round(256*image.naturalHeight/image.naturalWidth));
  context.drawImage(image,0,0,canvas.width,canvas.height);
  const frame=context.getImageData(0,0,canvas.width,canvas.height);
  const analysis={image:canvas.toDataURL('image/jpeg',.8),title:item.title,time:still.time,kind:'Fotogramma estratto da Archive'};
  const predictions=await vision({type:'classify',pixels:frame.data.buffer,width:frame.width,height:frame.height},[frame.data.buffer]);
  state.predictions=predictions; state.analysis=analysis; state.lastError=null;
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
  await primeCatalog(AbortSignal.timeout(5000)).catch(report);
  // One download at a time; a real, long first video gives the chain time to start.
  for (;;) {
    try {
      const first=await next([],AbortSignal.timeout(40000),[],true);
      first.selection.mode='initial';
      await cut(first); break;
    } catch(error) { report(error); await sleep(500); }
  }
  let warmup=vision({type:'warmup'}).catch(report);
  let ready=null, pending=false;
  async function prepareSuccessor() {
    pending=true;
    try {
      if(state.vision==='unavailable' && Date.now()>=visionRetryAt) warmup=vision({type:'warmup'}).catch(report);
      const modelReady=await Promise.race([warmup.then(()=>state.vision==='ready'),sleep(12000).then(()=>false)]);
      const active=videos[current];
      while(active===videos[current] && active.currentTime<Math.min(2,active.duration-.5)) await sleep(100);
      let terms=[];
      try {
        if(modelReady) terms=await recognize();
        else state.fallbackStatus='Modello ancora in caricamento: preparo un nuovo video';
        for(const term of terms) keywordOrigins.set(term,{from:state.analysis.title,objects:state.predictions.map(p=>({...p}))});
      } catch(error) { report(error); }
      if(terms.length) {
        state.phase='preparing';
        state.fallbackStatus='Ricerca e download del successore correlato';
        try { return await next(terms,AbortSignal.timeout(35000)); }
        catch(error) { report(error); }
      }
      state.fallbackStatus='Ricerca correlata non pronta: download di un nuovo video casuale';
      return await next([],AbortSignal.timeout(35000),[],true);
    } finally { pending=false; }
  }
  let progressVideo,progressTime=0,progressAt=performance.now();
  for (;;) {
    if(!pending && !ready) prepareSuccessor().then(clip=>{
      ready=clip;
      state.fallbackStatus=clip.selection.success ? 'Successore correlato scaricato e pronto' : 'Nuova riserva casuale scaricata e pronta';
    }).catch(report);
    const active=videos[current];
    if(active!==progressVideo || active.currentTime>progressTime+.05) {progressVideo=active;progressTime=active.currentTime;progressAt=performance.now();}
    const stalled=performance.now()-progressAt>3000;
    const elapsed=(performance.now()-state.shotStarted)/1000;
    const remaining=Math.max(0,active.duration-active.currentTime);
    state.shotDeadline=state.shotStarted+Math.min(MAX_SHOT_SECONDS,elapsed+remaining)*1000;
    const decision=decideCut({related:ready?.selection.success,elapsed,duration:active.duration,remaining,ended:active.ended || stalled,maxSeconds:MAX_SHOT_SECONDS});
    if(ready && (decision || elapsed>=60)) {
      const incoming=ready; ready=null;
      try { await cut(incoming); }
      catch(error) { report(error); }
    }
    await sleep(100);
  }
}

run().catch(error => { state.phase='error'; report(error); status.hidden = false; status.textContent = 'Impossibile avviare Spiral. Ricarica per riprovare.'; });
