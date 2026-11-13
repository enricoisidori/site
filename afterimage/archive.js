import { sanitizeTerms } from './terms.js';
import { archiveJSON as json } from './archive-transport.js';
import { sourceScopes, exclusionTerms, promotionalMetadata, filterState, blockedCollection, excludedContent } from './scope.js';
export const SEARCH_LIMIT = 10000;
export const SORTS = ['identifier asc', 'identifier desc', 'addeddate asc', 'addeddate desc'];
export const pick = values => values[Math.floor(Math.random() * values.length)];
export function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function queryFor(terms = [], scope = sourceScopes[0]) {
  const clauses = sanitizeTerms(terms).map(term => `title:"${term}"`);
  const blocked = exclusionTerms.join(' OR ');
  return `mediatype:movies${scope ? ` AND ${scope}` : ''}${clauses.length ? ` AND (${clauses.join(' OR ')})` : ''}${filterState.content ? ` AND NOT (${blocked})` : ''}${filterState.collections.map(id=>` AND NOT collection:"${id.replace(/[^a-zA-Z0-9_.-]/g,'')}"`).join('')} AND NOT access-restricted-item:true`;
}
export function searchURL(query, rows, page, sort, fields = ['identifier', 'title']) {
  const p = new URLSearchParams({ q: query, rows, page, output: 'json' });
  for (const field of fields) p.append('fl[]', field);
  if (sort) p.append('sort[]', sort);
  return `https://archive.org/advancedsearch.php?${p}`;
}
// Uniform draws over the WHOLE Archive (see tools/build-archive-partition.mjs).
// The library is cut into consecutive publicdate windows ("drawers") of fewer
// than 10,000 items. A random number picks a drawer by its size and a position
// inside it; one rows=1 request returns exactly that item. Date windows answer
// in under a second (identifier ranges took 8-15 s). Filters run afterwards on
// metadata, so the draw stays uniform among eligible items.
const LIMIT = 10000;
const iso = seconds => new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
const windowQuery = (base, from, to) => `${base} AND publicdate:[${iso(from)} TO ${to == null ? '*' : iso(to)}]`;
const UNDATED = 'NOT publicdate:[1900-01-01T00:00:00Z TO 2100-01-01T00:00:00Z]';
function cumulative(index) {
  let sum = 0;
  index.starts = index.drawers.map(d => (sum += d[1]) - d[1]);
  index.dated = sum; index.tail = index.tail || 0;
  index.total = sum + (index.undated || 0) + index.tail;
  return index;
}
let globalIndex;
const loadGlobal = () => globalIndex ||= fetch(new URL('./partition.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('indice Archive mancante'); return r.json(); }).then(index => {
  cumulative(index);
  // Videos published after the index was built: counted live, once, without
  // delaying the first draw. They become one more drawer.
  json(searchURL(windowQuery(index.query, index.end + 1, null), 0, 1), undefined, { scrape: false })
    .then(d => { index.tail = d.response?.numFound || 0; cumulative(index); }).catch(() => {});
  return index;
});
const drawerAt = (index, rank) => { let a = 0, b = index.starts.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (index.starts[m] <= rank) a = m; else b = m - 1; } return a; };
const drawerEnd = (index, i) => i + 1 < index.drawers.length ? index.drawers[i + 1][0] - 1 : index.end;
// A moment in time chosen so that every stretch of the library weighs as many
// videos as it holds (not as many days as it lasts).
function randomInstant(index) {
  const rank = Math.floor(Math.random() * index.dated), i = drawerAt(index, rank), [from, count] = index.drawers[i];
  return Math.round(from + (rank - index.starts[i]) / count * (drawerEnd(index, i) - from));
}
const FIELDS = ['identifier', 'title', 'collection'];
async function draw(index, signal) {
  const base = index.query, rank = Math.floor(Math.random() * index.total);
  let q, offset, count, sort = 'publicdate';
  if (rank < index.dated) {
    const i = drawerAt(index, rank); offset = rank - index.starts[i]; count = index.drawers[i][1];
    q = windowQuery(base, index.drawers[i][0], drawerEnd(index, i));
  } else if (rank < index.dated + (index.undated || 0)) {
    offset = rank - index.dated; count = index.undated; q = `${base} AND ${UNDATED}`; sort = 'identifier';
  } else {
    offset = rank - index.dated - (index.undated || 0); count = index.tail;
    // A long tail (index not rebuilt for a while) is entered at a random moment.
    if (count >= 2 * LIMIT) { const now = Math.floor(Date.now() / 1000); q = windowQuery(base, index.end + 1 + Math.floor(Math.random() * Math.max(1, now - index.end)), null); offset = 0; count = 1; }
    else q = windowQuery(base, index.end + 1, null);
  }
  const desc = offset >= LIMIT, page = desc ? count - offset : offset + 1;
  const d = await json(searchURL(q, 1, page, `${sort} ${desc ? 'desc' : 'asc'}`, FIELDS), signal, { scrape: false });
  return d.response?.docs?.[0] || null;
}
// General stream (first video and fallbacks): one independent uniform ticket.
// Blocked collections are dropped here, before any metadata request.
export async function drawOne(terms, signal) {
  const global = await loadGlobal();
  const item = await draw(global, signal);
  return { query: global.query, total: global.total, item: item && !blockedCollection(item) ? item : null };
}
// Keyword search: any video whose title has the word, never ranked by
// relevance or popularity. One request: the matches that follow (or precede) a
// random moment of the library, in date order. Every match is reachable
// whatever the size of the result, and no count has to come back first.
const keywordTotals = new Map(), prefetched = new Map();
async function keywordSearch(terms, signal) {
  const global = await loadGlobal();
  const clauses = sanitizeTerms(terms).map(term => `title:"${term}"`);
  const base = `${global.query} AND (${clauses.join(' OR ')})`;
  const moment = randomInstant(global), first = pick(['asc', 'desc']);
  const side = direction => json(searchURL(`${base} AND publicdate:${direction === 'asc' ? `[${iso(moment)} TO *]` : `[* TO ${iso(moment)}]`}`, 50, 1, `publicdate ${direction}`, FIELDS), signal, { scrape: false }).then(d => d.response);
  const a = await side(first);
  let docs = a.docs || [], total = keywordTotals.get(base);
  // Few matches on this side of the moment: the other side completes the set.
  if (docs.length < 50) {
    const b = await side(first === 'asc' ? 'desc' : 'asc');
    const seen = new Set(docs.map(d => d.identifier));
    docs = [...docs, ...(b.docs || []).filter(d => !seen.has(d.identifier))];
    total = Math.max(docs.length, (a.numFound || 0) + (b.numFound || 0));
    keywordTotals.set(base, total);
  } else if (total == null) {
    // Only for the figure shown in the panel; the candidates do not wait for it.
    total = a.numFound;
    json(searchURL(base, 0, 1), undefined, { scrape: false }).then(d => keywordTotals.set(base, d.response?.numFound || a.numFound)).catch(() => {});
  }
  // The search also matches inflected forms ("wigs" for "wig"); only literal
  // matches can become links, so the others are dropped before any metadata request.
  const literal = docs.filter(d => !blockedCollection(d) && metadataMatches({ title: d.title }, terms).length);
  return { query: base, total: docs.length && !literal.length && docs.length < 50 ? 0 : total, sort: `publicdate ${first}`, items: shuffle(literal) };
}
// The next query can start while its video is still buffering.
export function prefetchKeyword(terms) {
  const key = sanitizeTerms(terms).join('|');
  if (!key || prefetched.has(key)) return;
  const entry = { at: Date.now(), promise: keywordSearch(terms, AbortSignal.timeout(20000)) };
  entry.promise.catch(() => {}); prefetched.set(key, entry);
  for (const [k, e] of prefetched) if (Date.now() - e.at > 120000) prefetched.delete(k);
}
export async function search(terms, signal, draws = 3) {
  if (sanitizeTerms(terms).length) {
    const key = sanitizeTerms(terms).join('|'), ready = prefetched.get(key);
    prefetched.delete(key);
    if (ready && Date.now() - ready.at < 120000) { try { return await ready.promise; } catch {} }
    return keywordSearch(terms, signal);
  }
  const results = await Promise.all(Array.from({ length: draws }, () => drawOne(terms, signal).catch(() => null)));
  const first = results.find(Boolean) || { query: '', total: 0 };
  return { query: first.query, total: first.total, page: null, sort: 'uniforme', items: results.map(r => r?.item).filter(Boolean) };
}
export function durationSeconds(value) {
  if (typeof value === 'string' && value.includes(':')) return value.split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0);
  return Number(value) || 0;
}
// Light derivatives are still preferred (see the ranking below). The ceiling
// only decides which items have no playable file at all: with byte-range
// playback a heavier original no longer has to be downloaded from its start.
export function streamableFiles(files, { maxBitrate = 1000000, maxHeight = 720 } = {}) {
  return files.filter(f => {
    const duration = durationSeconds(f.length), size = Number(f.size), height = Number(f.height);
    if (!/\.mp4$/i.test(f.name || '') || f.private || size <= 10000) return false;
    if (height > maxHeight) return false;
    const bitrate = duration ? size * 8 / duration : 0;
    return /512Kb MPEG4/i.test(f.format || '') || bitrate > 0 && bitrate <= maxBitrate
      || !bitrate && height > 0 && height <= 480 && f.source === 'derivative';
  }).sort((a, b) => {
    const rank = f => Number(!/512Kb MPEG4/i.test(f.format || '')) * 10000000
      + Math.abs((Number(f.height) || 240) - 240) * 10000
      + (Number(f.size) * 8 / durationSeconds(f.length) || 1000000);
    return rank(a) - rank(b);
  });
}
const text = value => (Array.isArray(value) ? value.join(' · ') : String(value || '')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export function metadataMatches(metadata, terms) {
  const words = sanitizeTerms(terms);
  return ['title'].flatMap(field => {
    const value = text(metadata[field]);
    const matches = words.filter(term => new RegExp(`\\b${term}\\b`, 'i').test(value));
    return matches.length ? [{ field, text: value, terms: matches }] : [];
  });
}
export async function resolveItem(item, terms, signal, limits) {
  const d = await json(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`, signal);
  const md = d.metadata || {};
  if (d.is_dark || md['access-restricted-item'] === 'true' || excludedContent(md) || promotionalMetadata(md) || blockedCollection(md)) return null;
  const matches = metadataMatches(md, terms);
  if (terms.length && !matches.length) return null;
  const f = streamableFiles(d.files || [], limits)[0];
  if (!f) return null;
  return {
    id: item.identifier, title: text(md.title) || item.identifier,
    subject: text(md.subject), matches, filename: f.name, original: f.original,
    collection: text(md.collection), collections: [].concat(md.collection || []), creator: text(md.creator), contributor: text(md.contributor),
    publisher: text(md.publisher), added: text(md.addeddate), format: text(f.format),
    width: Number(f.width) || null, height: Number(f.height) || null,
    uploader: text(md.uploader), date: text(md.date || md.year), language: text(md.language),
    description: text(md.description).slice(0, 420), identifier: item.identifier,
    frames: (d.files || []).flatMap(file => {
      const m = file.name?.match(/\.thumbs\/([^/]+)_(\d{6})\.jpg$/i);
      return m ? [{ name: file.name, stem: m[1], time: Number(m[2]) }] : [];
    }),
    streamURL: `https://archive.org/cors/${encodeURIComponent(item.identifier)}/${f.name.split('/').map(encodeURIComponent).join('/')}`,
    bytes: Number(f.size), duration: durationSeconds(f.length) || null,
    license: text(md.licenseurl || md.rights),
    source: `https://archive.org/details/${encodeURIComponent(item.identifier)}`,
  };
}
