import { commonsCandidates, commonsMatches } from './commons-api.js?v=runtime-51';
import { searchPlan, searchTerms } from './archive.js?v=runtime-51';
import { setupInfo } from './info.js?v=runtime-51';
import { setupWords } from './words.js?v=runtime-51';

const state = window.spiral = { kind: 'image', provider: 'Wikimedia Commons', phase: 'starting',
  current: null, predictions: [], history: [], vision: 'loading', query: '', lastError: null };
setupInfo(state, []);
setupWords(state);
const status = document.querySelector('#status');
const recent = [];
const origins = new Map();
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let currentImage;
let worker;
let requestId = 0;
function report(error) { state.lastError = error.message || String(error); console.warn('[spiral commons]', state.lastError); }
async function classify(data) {
  worker ||= new Worker(new URL('./vision-worker.js?v=runtime-51', import.meta.url), { type: 'module' });
  const target = worker;
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    function done(error, value) {
      clearTimeout(timer);
      target.removeEventListener('message', onMessage);
      target.removeEventListener('error', onError);
      if (error) {
        target.terminate(); worker = null; state.vision = 'unavailable'; reject(error);
      } else { state.vision = 'ready'; resolve(value); }
    }
    const onMessage = ({ data }) => {
      if (data.id === id) { state.model = data.model; state.caption = data.caption; done(data.error ? new Error(data.error) : null, data.predictions); }
    };
    const onError = event => done(new Error(event.message || 'Vision worker error'));
    const timer = setTimeout(() => done(new Error('Vision timeout')), 120000);
    target.addEventListener('message', onMessage);
    target.addEventListener('error', onError);
    target.postMessage({ type: 'classify', id, ...data }, [data.pixels]);
  });
}
async function prepare(item) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.alt = item.title;
  image.className = 'commons-picture';
  image.src = item.imageUrl;
  let timer;
  try {
    await Promise.race([image.decode(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Image decode timeout')), 30000);
    })]);
    return image;
  } catch (error) { image.removeAttribute('src'); throw error; }
  finally { clearTimeout(timer); }
}
async function next(terms = []) {
  const selection = { from: state.current?.title || null, terms: [...terms], objects: [], attempts: [], query: null };
  state.search = selection;
  for (const { term, field } of searchPlan(terms, !state.current)) {
    state.query = term || '(random)';
    const attempt = { query: term || '(random)', field, count: null, status: 'Ricerca…' };
    selection.attempts.push(attempt);
    try {
      const candidates = await commonsCandidates(term, field);
      attempt.count = candidates.length;
      attempt.status = candidates.length ? 'Verifica metadati e caricamento…' : 'Nessun risultato';
      for (const item of candidates.filter(item => !recent.includes(item.id))) {
        const matches = term ? commonsMatches(item, term, field) : [];
        if (term && !matches.length) continue;
        try {
          const image = await prepare(item);
          Object.assign(selection, { to: item.title, query: term || null, field,
            matches, success: Boolean(term), mode: term ? 'visual' : 'initial',
            objects: origins.get(term)?.objects || [], from: origins.get(term)?.from || null,
            status: term ? 'Collegamento verificato: immagine pronta' : 'Prima immagine casuale pronta' });
          attempt.status = 'Immagine pronta';
          return { item, image, selection: structuredClone(selection) };
        } catch (error) { report(error); }
      }
      attempt.status = 'Nessuna immagine correlata e caricabile tra i risultati';
    } catch (error) { attempt.status = 'Errore Commons'; report(error); }
  }
  selection.status = 'Collegamento non ancora trovato: mantengo l’immagine corrente e riprovo.';
  throw new Error(selection.status);
}
function cut(prepared) {
  prepared.image.classList.add('active');
  document.querySelector('main').replaceChildren(prepared.image);
  currentImage = prepared.image;
  state.current = prepared.item;
  state.selection = prepared.selection;
  state.phase = 'playing';
  state.lastError = null;
  recent.push(prepared.item.id);
  if (recent.length > 40) recent.shift();
  state.history.push({ id: prepared.item.id, source: prepared.item.source, license: prepared.item.license, selection: prepared.selection });
  if (state.history.length > 200) state.history.shift();
  status.hidden = true;
}
async function recognize() {
  state.phase = 'analyzing';
  const scale = 256 / Math.max(currentImage.naturalWidth, currentImage.naturalHeight);
  canvas.width = Math.max(1, Math.round(currentImage.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(currentImage.naturalHeight * scale));
  context.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data.buffer;
  const analysis = { image: canvas.toDataURL('image/jpeg', .8), title: state.current.title, time: 0 };
  state.predictions = await classify({ pixels, width: canvas.width, height: canvas.height });
  state.analysis = analysis;
  const terms = searchTerms(state.predictions);
  for (const term of terms) origins.set(term, { from: state.current.title, objects: state.predictions.filter(p => (p.score == null || p.score >= .06)) });
  return terms;
}
document.querySelector('main').addEventListener('click', () => document.documentElement.requestFullscreen?.().catch(report));
async function run() {
  while (!state.current) {
    try { cut(await next()); }
    catch (error) { report(error); status.textContent = 'Commons non disponibile. Riprovo…'; await sleep(5000); }
  }
  for (;;) {
    const earliest = performance.now() + 8000;
    try {
      const terms = await recognize();
      state.phase = 'preparing';
      const prepared = await next(terms);
      await sleep(Math.max(0, earliest - performance.now()));
      cut(prepared);
      origins.clear();
    } catch (error) { report(error); state.phase = 'retrying'; await sleep(7000); }
  }
}
run().catch(report);
