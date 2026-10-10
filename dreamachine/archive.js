import { MAX_VIDEO_BYTES, MIN_VIDEO_SECONDS } from './config.js';
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
  const pattern = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
  return Object.entries(names).flatMap(([key, field]) => {
    const raw = metadata?.[key];
    const text = (Array.isArray(raw) ? raw.join(' · ') : String(raw || ''))
      .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const found = pattern.exec(text);
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
  const params = new URLSearchParams({ q: whole ? `mediatype:movies AND NOT access-restricted-item:true AND identifier:${'abcdefghijklmnopqrstuvwxyz0123456789'[randomInt(36)]}*` : searchQuery(term, field), rows: '1', page: '1' });
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
    && Number(f.size) <= MAX_VIDEO_BYTES
    && (!Number(f.length) || Number(f.length) >= MIN_VIDEO_SECONDS))
    .sort((a, b) => {
      const rank = f => /512kb/i.test(f.name) ? 0 : /h\.264/i.test(f.format || '') ? 1 : 2;
      return rank(a) - rank(b) || Number(a.size) - Number(b.size);
    });
}
export async function resolveItem(item, signal) {
  const metadata = await json(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`, signal);
  if (metadata.is_dark || metadata.metadata?.['access-restricted-item'] === 'true') return null;
  const files = playableFiles(metadata.files || []);
  if (!files.length) return null;
  return {
    id: item.identifier, title: metadata.metadata?.title || item.identifier,
    searchMetadata: Object.fromEntries(['title', 'subject', 'description'].map(key => [key, metadata.metadata?.[key]])),
    source: `https://archive.org/details/${encodeURIComponent(item.identifier)}`,
    license: metadata.metadata?.licenseurl || metadata.metadata?.rights || null,
    bytes: Number(files[0].size),
    urls: files.slice(0, 2).map(f => archiveMediaURL(item.identifier, f.name)),
  };
}

export function videoTerms(predictions) {
  const terms = [];
  for (const prediction of predictions.filter(p => p.score >= .06).slice(0, 3)) {
    const labels = prediction.label.toLowerCase().split(',').map(s => s.trim());
    terms.push(labels[0]);
    if (/cash machine|cash dispenser|teller machine/.test(prediction.label.toLowerCase())) terms.push('atm');
    if (/cellular|cellphone|mobile phone/.test(prediction.label.toLowerCase())) terms.push('telephone', 'phone');
  }
  return [...new Set(terms)].slice(0, 6);
}
export function videoQuery(term) {
  const safe = term.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
  return `mediatype:movies AND NOT access-restricted-item:true AND (title:"${safe}" OR description:"${safe}" OR subject:"${safe}")`;
}
export async function videoCandidates(term, signal, page = 1) {
  const params = new URLSearchParams({ q: videoQuery(term), rows: '20', page: String(page), sort: 'relevance' });
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
  for (const prediction of predictions.filter(p => p.score >= .06)) {
    const labels = prediction.label.toLowerCase().split(',').map(s => s.trim());
    terms.push(...labels);
    const family = families.find(([pattern]) => pattern.test(labels[0]));
    if (family) broad.push(family[1]);
  }
  return [...new Set([...terms, ...broad])].slice(0, 16);
}
