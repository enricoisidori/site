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
export function searchURL(query, rows, page, sort) {
  const p = new URLSearchParams({ q: query, rows, page, output: 'json' });
  p.append('fl[]', 'identifier'); p.append('fl[]', 'title');
  if (sort) p.append('sort[]', sort);
  return `https://archive.org/advancedsearch.php?${p}`;
}
// Uniform draws over the WHOLE Archive (see tools/build-archive-partition.mjs).
// Each item is one independent ticket: a random number picks a drawer of the
// prebuilt index and a position inside it, and a single rows=1 request returns
// exactly that item. Filters run afterwards on metadata (rejection keeps the
// draw uniform among eligible items), so the index never depends on them.
const LIMIT = 10000, PREFIXES = [...'abcdefghijklmnopqrstuvwxyz0123456789'];
const quote = id => `"${String(id).replace(/["\\]/g, '\\$&')}"`;
const drawerQuery = (base, [prefix, lo, hi]) => `${base} AND identifier:${prefix}*${lo ? ` AND identifier:[${quote(lo)} TO *]` : ''}${hi ? ` AND NOT identifier:[${quote(hi)} TO *]` : ''}`;
function cumulative(index) { let sum = 0; index.starts = index.drawers.map(d => (sum += d[3]) - d[3]); index.total = sum; return index; }
let globalIndex;
const loadGlobal = () => globalIndex ||= fetch(new URL('./partition.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('indice Archive mancante'); return r.json(); }).then(cumulative);
async function draw(index, base, signal) {
  const r = Math.floor(Math.random() * index.total);
  let a = 0, b = index.starts.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (index.starts[m] <= r) a = m; else b = m - 1; }
  const drawer = index.drawers[a], offset = r - index.starts[a];
  const q = drawer[0] === null ? base : drawerQuery(base, drawer);
  const desc = offset >= LIMIT, page = desc ? drawer[3] - offset : offset + 1;
  const d = await json(searchURL(q, 1, page, desc ? 'identifier desc' : 'identifier asc'), signal, { scrape: false });
  return d.response?.docs?.[0] || null;
}
// General stream (first video and fallbacks): one independent uniform ticket.
export async function drawOne(terms, signal) {
  const global = await loadGlobal();
  return { query: global.query, total: global.total, item: await draw(global, global.query, signal) };
}
// Keyword search: any video whose title has the word, never ranked by
// relevance or popularity. Small sets: a random page in identifier order.
// Large sets: a drawer of the global index picked by size (so every match is
// reachable), then a random page of the matches inside it.
const keywordTotals = new Map();
async function keywordSearch(terms, signal) {
  const global = await loadGlobal();
  const clauses = sanitizeTerms(terms).map(term => `title:"${term}"`);
  const base = `${global.query} AND (${clauses.join(' OR ')})`;
  if (!keywordTotals.has(base)) keywordTotals.set(base, (await json(searchURL(base, 1, 1), signal, { scrape: false })).response?.numFound || 0);
  const total = keywordTotals.get(base);
  if (!total) return { query: base, total, items: [] };
  const sort = pick(['identifier asc', 'identifier desc']);
  if (total <= LIMIT) {
    const d = await json(searchURL(base, 50, 1 + Math.floor(Math.random() * Math.ceil(total / 50)), sort), signal, { scrape: false });
    return { query: base, total, sort, items: shuffle(d.response?.docs || []) };
  }
  for (let tries = 0; tries < 4; tries++) {
    const r = Math.floor(Math.random() * global.total);
    let a = 0, b = global.starts.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (global.starts[m] <= r) a = m; else b = m - 1; }
    const q = drawerQuery(base, global.drawers[a]);
    let d = await json(searchURL(q, 50, 1, sort), signal, { scrape: false });
    const found = d.response?.numFound || 0;
    if (!found) continue;
    const page = 1 + Math.floor(Math.random() * Math.ceil(Math.min(found, LIMIT) / 50));
    if (page > 1) d = await json(searchURL(q, 50, page, sort), signal, { scrape: false });
    return { query: base, total, sort, items: shuffle(d.response?.docs || []) };
  }
  return { query: base, total, items: [] };
}
export async function search(terms, signal, draws = 3) {
  if (sanitizeTerms(terms).length) return keywordSearch(terms, signal);
  const results = await Promise.all(Array.from({ length: draws }, () => drawOne(terms, signal).catch(() => null)));
  const first = results.find(Boolean) || { query: '', total: 0 };
  return { query: first.query, total: first.total, page: null, sort: 'uniforme', items: results.map(r => r?.item).filter(Boolean) };
}
export function durationSeconds(value) {
  if (typeof value === 'string' && value.includes(':')) return value.split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0);
  return Number(value) || 0;
}
export function streamableFiles(files) {
  return files.filter(f => {
    const duration = durationSeconds(f.length), size = Number(f.size), height = Number(f.height);
    if (!/\.mp4$/i.test(f.name || '') || f.private || size <= 10000) return false;
    if (height > 720) return false;
    const bitrate = duration ? size * 8 / duration : 0;
    return /512Kb MPEG4/i.test(f.format || '') || bitrate > 0 && bitrate <= 1000000
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
export async function resolveItem(item, terms, signal) {
  const d = await json(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`, signal);
  const md = d.metadata || {};
  if (d.is_dark || md['access-restricted-item'] === 'true' || excludedContent(md) || promotionalMetadata(md) || blockedCollection(md)) return null;
  const matches = metadataMatches(md, terms);
  if (terms.length && !matches.length) return null;
  const f = streamableFiles(d.files || [])[0];
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
