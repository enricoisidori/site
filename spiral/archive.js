import { mediaBitrate } from './media-policy.js?v=runtime-51';
import { catalogRecord } from './catalog.js?v=runtime-51';
import { MAX_VIDEO_BYTES, MIN_VIDEO_SECONDS, LIMITED_ARCHIVE, DARKROOM } from './config.js?v=runtime-51';
// A bounded archive, not YouTube's ranked recommendations.
export const COLLECTIONS = '(collection:prelinger OR collection:home_movies OR collection:prelingerhomemovies)';
const BASE = `mediatype:movies AND ${COLLECTIONS} AND NOT access-restricted-item:true`;
export const randomInt = max => Math.floor(Math.random() * max);
export const shuffle = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
export function searchQuery(term = '', field = '') {
  const safe = term.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
  if (!safe) return BASE;
  const fields = ['title', 'description', 'subject'];
  return BASE + ` AND (${(fields.includes(field) ? [field] : fields).map(key => `${key}:"${safe}"`).join(' OR ')})`;
}
export function searchPlan(terms, initial = false) {
  if (initial) return [{ term: '', field: '' }];
  return ['title', 'description', 'subject'].flatMap(field => [...new Set(terms)].map(term => ({ term, field })));
}
export function metadataMatches(metadata, term) {
  const needle = term.toLowerCase().trim();
  if (!needle) return [];
  const names = { title: 'Titolo', description: 'Descrizione', subject: 'Soggetti' };
  const escaped=needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
  // Archive often describes multiple objects: car/cars, city/cities, train/trains.
  const lexical=/[^aeiou]y$/.test(needle) ? escaped.slice(0,-1)+'(?:y|ies)'
    : needle.length>4 && /s$/.test(needle) && !/(ss|us|is)$/.test(needle) ? escaped.slice(0,-1)+'s?'
    : /(?:s|x|ch|sh)$/.test(needle) ? escaped+'(?:es)?' : escaped+'s?';
  const pattern = new RegExp(`\\b${lexical}\\b`,'i');
  return Object.entries(names).flatMap(([key, field]) => {
    const raw = metadata?.[key];
    const text = (Array.isArray(raw) ? raw.join(' · ') : String(raw || ''))
      .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const found = [...text.matchAll(new RegExp(pattern.source, 'gi'))].find(hit => {
      const context = text.slice(Math.max(0,hit.index-100),hit.index+hit[0].length+100);
      if (key === 'description' && /\b(?:follow (?:us|me)|subscribe to|sign up for|bridging the gap between|brings participatory democracy|into your living room)\b/i.test(context)) return false;
      // A photographed sign is not the marketing instruction “sign up”.
      if (needle === 'sign' && /^\s+(?:up|in|out|off|into)\b/i.test(text.slice(hit.index + hit[0].length))) return false;
      return true;
    });
    if (!found) return [];
    const index = found.index;
    const start = Math.max(0, index - 80);
    return [{ field, key, keyword: found[0], before: text.slice(start, index), after: text.slice(index + found[0].length, index + found[0].length + 100), excerpt: text.slice(start, index + found[0].length + 100) }];
  });
}
// Official public endpoints work on static hosts, including GitHub Pages.
export function archiveSearchURL(params) {
  const query = new URLSearchParams(params);
  const relevance = query.get('sort') === 'relevance';
  query.delete('sort');
  query.set('output', 'json');
  query.set('fl[]', 'identifier');
  if (!relevance) query.set('sort[]', 'identifier asc');
  return `https://archive.org/advancedsearch.php?${query}`;
}
export function archiveMediaURL(identifier, filename) {
  // /download redirects to storage nodes without CORS headers. /cors is
  // Archive's own endpoint for fetching media from another website.
  return `https://archive.org/cors/${encodeURIComponent(identifier)}/${filename.split('/').map(encodeURIComponent).join('/')}`;
}
async function json(url, signal) {
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(18000)]) : AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(`Archive HTTP ${response.status}`);
  return response.json();
}
export async function candidates(term = '', field = '', whole = false, signal) {
  const params = new URLSearchParams({ q: whole ? `mediatype:movies AND NOT access-restricted-item:true AND identifier:${'abcdefghijklmnopqrstuvwxyz0123456789'[randomInt(36)]}* AND item_size:[10000 TO 12000000] AND (format:"MPEG4" OR format:"512Kb MPEG4" OR format:"h.264")` : `${searchQuery(term, field)}${!term ? ' AND item_size:[10000 TO 60000000] AND (format:"MPEG4" OR format:"512Kb MPEG4" OR format:"h.264")' : ''}`, rows: '1', page: '1' });
  const first = await json(archiveSearchURL(params), signal);
  const total = first.response?.numFound || 0;
  if (!total) return [];
  // Random page, then shuffle within it. The incomplete last page is weighted
  // by selecting a random item offset, rather than a uniformly random page.
  const page = Math.floor(randomInt(whole ? Math.min(total, 10000) : total) / 20) + 1;
  params.set('rows', '20');
  params.set('page', String(page));
  const result = await json(archiveSearchURL(params), signal);
  return shuffle(result.response?.docs || []);
}
export function playableFiles(files) {
  return files.filter(f => /\.mp4$/i.test(f.name) && !f.private && Number(f.size) > 10000
    && Number(f.size) <= MAX_VIDEO_BYTES && mediaBitrate(f)<=700000
    && (!Number(f.length) || Number(f.length) >= MIN_VIDEO_SECONDS))
    .sort((a,b)=>Number(Number(b.length)>=45)-Number(Number(a.length)>=45) || Number(a.size)-Number(b.size));
}
export async function resolveItem(item, signal) {
  const metadata = catalogRecord(item.identifier) || await json(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`, signal);
  if (metadata.is_dark || metadata.metadata?.['access-restricted-item'] === 'true') return null;
  const files = playableFiles(metadata.files || []);
  if (!files.length) return null;
  return {
    frames: archiveFrames(metadata.files || []),
    id: item.identifier, title: metadata.metadata?.title || item.identifier,
    searchMetadata: Object.fromEntries(['title', 'subject', 'description'].map(key => [key, metadata.metadata?.[key]])),
    source: `https://archive.org/details/${encodeURIComponent(item.identifier)}`,
    license: metadata.metadata?.licenseurl || metadata.metadata?.rights || null,
    bytes: Number(files[0].size), duration: Number(files[0].length) || null,
    urls: files.slice(0, 2).map(f => archiveMediaURL(item.identifier, f.name)),
    contentHashes: files.slice(0,2).map(f=>f.md5 ? `md5:${f.md5}` : null),
  };
}

export function videoTerms(predictions) {
  const terms = [];
  for (const prediction of predictions.filter(p => (p.score == null || p.score >= .06)).slice(0, 3)) {
    const labels = prediction.label.toLowerCase().split(',').map(s => s.trim());
    terms.push(labels[0]);
    if(prediction.score == null && labels[0].includes(' ')) terms.push(labels[0].split(' ').at(-1));
    if (/\btrains?\b/.test(labels[0])) terms.push('railroad');
    if (/\bcars?\b/.test(labels[0])) terms.push('automobile');
    if (/\b(?:airplanes?|aircraft|planes?)\b/.test(labels[0])) terms.push('aviation');
    if (/cash machine|cash dispenser|teller machine/.test(prediction.label.toLowerCase())) terms.push('atm');
    if (/cellular|cellphone|cell phone|mobile phone|telephone/.test(prediction.label.toLowerCase())) terms.push('telephone', 'phone');
  }
  return [...new Set(terms)].slice(0, 6);
}
export function videoQuery(term, primary=false) {
  const terms=(Array.isArray(term)?term:[term]).map(value=>value.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().slice(0,70)).filter(Boolean).slice(0,6);
  const clauses=terms.flatMap(value=>(primary ? ['title','subject'] : ['title','description','subject']).map(field=>`${field}:"${value}"`));
  return `${LIMITED_ARCHIVE ? BASE : "mediatype:movies AND NOT access-restricted-item:true"} AND item_size:[10000 TO 80000000]${DARKROOM ? ' AND (title:"black screen" OR title:"black video" OR title:"blank screen")' : ''}${clauses.length ? ` AND (${clauses.join(' OR ')})` : ''}`;
}
export async function videoCandidates(term, signal, page = 1, primary=false) {
  const params = new URLSearchParams({ q: videoQuery(term,primary), rows: '6', page: String(page), sort: 'relevance' });
  const result = await json(archiveSearchURL(params), signal);
  return { items: result.response?.docs || [], total: result.response?.numFound || 0 };
}

// ImageNet's precise object names often have little overlap with archive tags.
// Broaden known objects, retaining literal words as alternative searches.
export function searchTerms(predictions) {
  const families = [
    [/car|cab|truck|bus|jeep|limousine|racer|ambulance|minivan|wagon|tractor/, 'automobile'],
    [/ship|boat|canoe|liner|gondola|schooner|yawl/, 'boat'],
    [/plane|airliner|wing|parachute/, 'airplane'],
    [/train|locomotive|streetcar/, 'train'],
    [/dog|retriever|terrier|hound|poodle|shepherd/, 'dog'],
    [/bird|finch|eagle|owl|parrot|robin/, 'bird'],
    [/beach|sandbar|seashore|ocean/, 'beach'],
    [/mountain|alp|volcano|valley/, 'mountain'],
    [/forest|tree|wood|park/, 'forest'],
    [/building|palace|church|monastery|tower|castle/, 'architecture'],
  ];
  const terms = [];
  const broad = [];
  for (const prediction of predictions.filter(p => (p.score == null || p.score >= .06))) {
    const labels = prediction.label.toLowerCase().split(',').map(s => s.trim());
    terms.push(...labels);
    const family = families.find(([pattern]) => pattern.test(labels[0]));
    if (family) broad.push(family[1]);
  }
  return [...new Set([...terms, ...broad])].slice(0, 16);
}

// Archive-generated scene images carry their timestamp in seconds.
export function archiveFrames(files) {
  return files.flatMap(file=>{
    const match=file.name?.match(/\.thumbs\/([^/]+)_(\d{6})\.jpg$/i);
    return match ? [{name:file.name,stem:match[1],time:Number(match[2])}] : [];
  });
}
export function nearestFrame(frames,filename,time) {
  const original=filename.replace(/\.mp4$/i,'');
  const stem=original.replace(/_(?:512kb|h264|3mb|mpeg4)$/i,'');
  const exact=frames.filter(frame=>frame.stem.toLowerCase()===original.toLowerCase());
  const matching=exact.length ? exact : frames.filter(frame=>frame.stem.toLowerCase()===stem.toLowerCase());
  // Never substitute a frame from another file in a multi-video item.
  return matching.sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time))[0] || null;
}
export async function sceneFrame(item,time,signal) {
  let frames=item.frames;
  if(!frames?.length) {
    const metadata=await json(`https://archive.org/metadata/${encodeURIComponent(item.id)}`,signal);
    frames=item.frames=archiveFrames(metadata.files || []);
  }
  const frame=nearestFrame(frames,item.filename,time);
  if(!frame) throw new Error('Archive non fornisce fotogrammi di questo file');
  return {...frame,url:archiveMediaURL(item.id,frame.name)};
}
