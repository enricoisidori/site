#!/usr/bin/env node
// Builds the "drawer" index that lets a browser draw one item uniformly from
// the WHOLE Internet Archive movie library with a single fast request.
//
// Archive search stops at the 10,000th result, so the library is cut into
// consecutive publicdate windows that each hold fewer than 10,000 items.
// Every item with a publicdate sits in exactly one window; the few without
// one form a last drawer of their own. Date windows answer in under a second,
// while identifier ranges (the previous index) took 8-15 seconds per draw.
//
//   node tools/build-archive-partition.mjs [--query "..."] [--out file] [--concurrency 6]
//
// Resumable: finished time spans are kept in <out>.partial.json; run it again
// after an interruption and only the missing spans are requested.
//
// Output: { query, builtAt, total, drawers: [[startEpochSeconds, count], ...],
//           end: epochSeconds, undated: count }
// Drawer i covers publicdate [start_i, start_{i+1} - 1]; the last one ends at
// `end`. Anything published after `end` is counted live by the page.

import { readFile, writeFile } from 'node:fs/promises';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const QUERY = arg('--query', 'mediatype:movies AND NOT access-restricted-item:true');
const OUT = arg('--out', 'afterimage/partition.json');
const CONCURRENCY = Number(arg('--concurrency', '6'));
const PAGE_LIMIT = 10000;
const UA = { 'User-Agent': 'archive partition builder (static site, low volume)' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const iso = seconds => new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
const epoch = text => Math.floor(Date.parse(text) / 1000);
export const windowQuery = (base, from, to) => `${base} AND publicdate:[${iso(from)} TO ${iso(to)}]`;
let requests = 0;

async function search(params) {
  for (let attempt = 0; ; attempt++) {
    try {
      requests++;
      const p = new URLSearchParams({ output: 'json', ...params });
      const response = await fetch('https://archive.org/advancedsearch.php?' + p, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (response.status === 429 || response.status >= 500) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.response) return data.response;
      throw new Error(String(data.error || 'no response').slice(0, 120));
    } catch (error) {
      if (attempt === 40) throw error;
      console.warn(`retry ${attempt + 1}: ${error.message}`);
      await sleep(Math.min(60000, 2000 * 2 ** attempt));
    }
  }
}
const edge = (q, direction) => search({ q, rows: '1', 'fl[]': 'publicdate', 'sort[]': 'publicdate ' + direction }).then(r => epoch(r.docs[0].publicdate));

// One chain walks a span of time: the 10,000th item of what is left gives the
// start of the next drawer, and the two consecutive totals give the exact size.
async function chain(from, to) {
  const drawers = [];
  let lo = from, left = null;
  while (lo <= to) {
    const r = await search({ q: windowQuery(QUERY, lo, to), rows: '1', page: String(PAGE_LIMIT), 'fl[]': 'publicdate', 'sort[]': 'publicdate asc' });
    if (left != null) drawers.at(-1)[1] = left - r.numFound;
    left = r.numFound;
    if (!left) break;
    drawers.push([lo, left]);
    const boundary = r.docs?.[0]?.publicdate;
    if (!boundary) break;
    // More than 10,000 items in one second: that second becomes its own drawer.
    lo = Math.max(epoch(boundary), lo + 1);
  }
  return drawers.filter(d => d[1] > 0);
}

const started = Date.now();
const PARTIAL = OUT + '.partial.json';
let saved = {}, resumed = null;
try { const p = JSON.parse(await readFile(PARTIAL, 'utf8')); if (p.query === QUERY) { resumed = p; saved = p.spans; } } catch {}
let [first, end, undated] = await Promise.all([
  edge(QUERY, 'asc'), edge(QUERY, 'desc'),
  search({ q: `${QUERY} AND NOT publicdate:[1900-01-01T00:00:00Z TO 2100-01-01T00:00:00Z]`, rows: '0' }).then(r => r.numFound),
]);
// A resumed run keeps the time span of the interrupted one, so its drawers fit.
if (resumed) ({ first, end } = resumed);
// Independent spans (one per quarter) so the chains can run side by side.
const spans = [];
for (let year = new Date(first * 1000).getUTCFullYear(); year <= new Date(end * 1000).getUTCFullYear(); year++) {
  for (let quarter = 0; quarter < 4; quarter++) {
    const a = Math.max(first, Date.UTC(year, quarter * 3, 1) / 1000), b = Math.min(end, Date.UTC(year, quarter * 3 + 3, 1) / 1000 - 1);
    if (a <= b) spans.push([a, b]);
  }
}
const results = spans.map(span => saved[span.join('-')]);
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < spans.length) {
    const i = next++;
    if (results[i]) continue;
    results[i] = await chain(...spans[i]);
    saved[spans[i].join('-')] = results[i];
    await writeFile(PARTIAL, JSON.stringify({ query: QUERY, first, end, spans: saved }));
    console.log(`${iso(spans[i][0]).slice(0, 10)}: ${results[i].length} drawers · ${requests} requests`);
  }
}));
const drawers = results.flat();
const total = drawers.reduce((sum, d) => sum + d[1], 0);
const live = (await search({ q: QUERY, rows: '0' })).numFound;
await writeFile(OUT, JSON.stringify({ query: QUERY, builtAt: new Date().toISOString(), pageLimit: PAGE_LIMIT, total: total + undated, liveTotalAtBuild: live, end, undated, drawers }));
console.log(`${drawers.length} drawers, ${total} dated + ${undated} undated = ${total + undated} (live ${live}), largest ${Math.max(...drawers.map(d => d[1]))}, ${requests} requests, ${Math.round((Date.now() - started) / 1000)} s → ${OUT}`);
