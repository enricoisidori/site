import { sanitizeTerms } from './terms.js';
import { sourceScope, exclusionTerms } from './scope.js';
export const SEARCH_LIMIT = 10000;
export const SORTS = ['identifier asc', 'identifier desc', 'addeddate asc', 'addeddate desc'];
export const pick = values => values[Math.floor(Math.random() * values.length)];
export function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function queryFor(terms = []) {
  const clauses = sanitizeTerms(terms).map(term => `title:"${term}"`);
  const blocked = exclusionTerms.join(' OR ');
  return `mediatype:movies${sourceScope ? ` AND ${sourceScope}` : ''}${clauses.length ? ` AND (${clauses.join(' OR ')})` : ''} AND NOT (${blocked}) AND NOT access-restricted-item:true AND format:(MPEG4 OR "h.264" OR "512Kb MPEG4")`;
}
export function searchURL(query, rows, page, sort) {
  const p = new URLSearchParams({ q: query, rows, page, output: 'json' });
  p.append('fl[]', 'identifier'); p.append('fl[]', 'title');
  if (sort) p.append('sort[]', sort);
  return `https://archive.org/advancedsearch.php?${p}`;
}
async function json(url, signal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(10000)]) });
  if (!response.ok) throw new Error(`archive http ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(String(data.error));
  return data;
}
const totals = new Map();
const countRequests = new Map();
export function randomPage(total, random = Math.random) {
  return Math.floor(Math.floor(random() * Math.min(total, SEARCH_LIMIT)) / 50) + 1;
}
export async function search(terms, signal) {
  const query = queryFor(terms);
  // The global movie index already exceeds 10k. Its first search needs only
  // one request. Keyword queries first obtain their true count, cached below.
  let total = totals.get(query);
  if (total == null && !terms.length) total = SEARCH_LIMIT;
  if (total == null) {
    if (!countRequests.has(query)) countRequests.set(query, json(searchURL(query, 1, 1), signal).then(d => {
      const count = d.response?.numFound || 0; totals.set(query, count); return count;
    }).finally(() => countRequests.delete(query)));
    total = await countRequests.get(query);
  }
  if (!total) return { query, total, items: [] };
  const page = randomPage(total), sort = pick(SORTS);
  const d = await json(searchURL(query, 50, page, sort), signal);
  const actualTotal = d.response?.numFound || 0;
  totals.set(query, actualTotal);
  if (totals.size > 128) totals.delete(totals.keys().next().value);
  return { query, total: actualTotal, page, sort, items: shuffle(d.response?.docs || []) };
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
  if (d.is_dark || md['access-restricted-item'] === 'true') return null;
  const matches = metadataMatches(md, terms);
  if (terms.length && !matches.length) return null;
  const f = streamableFiles(d.files || [])[0];
  if (!f) return null;
  return {
    id: item.identifier, title: text(md.title) || item.identifier,
    subject: text(md.subject), matches, filename: f.name, original: f.original,
    collection: text(md.collection), creator: text(md.creator), contributor: text(md.contributor),
    uploader: text(md.uploader), date: text(md.date || md.year), language: text(md.language),
    description: text(md.description).slice(0, 420), identifier: item.identifier,
    frames: (d.files || []).flatMap(file => {
      const m = file.name?.match(/\.thumbs\/([^/]+)_(\d{6})\.jpg$/i);
      return m ? [{ name: file.name, stem: m[1], time: Number(m[2]) }] : [];
    }),
    streamURL: `https://archive.org/download/${encodeURIComponent(item.identifier)}/${f.name.split('/').map(encodeURIComponent).join('/')}`,
    bytes: Number(f.size), duration: durationSeconds(f.length) || null,
    license: text(md.licenseurl || md.rights),
    source: `https://archive.org/details/${encodeURIComponent(item.identifier)}`,
  };
}
