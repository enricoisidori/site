#!/usr/bin/env node
// Builds a "drawer" index of an Internet Archive query so that a browser can
// draw one item uniformly from the WHOLE result set with a single request.
//
// Archive search stops at the 10,000th result. Sorted by identifier, the
// 10,000th item of a range is the first identifier of the next drawer, so
// every drawer holds 9,999 items and every item sits in exactly one drawer.
// One independent chain runs per leading character (identifier prefixes are
// case-insensitive and their counts sum to the total).
//
//   node tools/build-archive-partition.mjs [--query "..."] [--out file] [--concurrency 4]
//
// The output is resumable: completed chains are kept in <out>.partial.json.

import { readFile, writeFile, rename } from 'node:fs/promises';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const QUERY = arg('--query', 'mediatype:movies AND NOT access-restricted-item:true');
const OUT = arg('--out', 'afterimage-coverage/partition.json');
const CONCURRENCY = Number(arg('--concurrency', '4'));
const PAGE_LIMIT = 10000;
const UA = { 'User-Agent': 'enricoisidori.com archive partition builder (contact: site owner)' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let requests = 0;

async function search(params) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      requests++;
      const response = await fetch('https://archive.org/advancedsearch.php?' + new URLSearchParams({ output: 'json', ...params }), { headers: UA, signal: AbortSignal.timeout(60000) });
      if (response.status === 429 || response.status >= 500) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.response) return data.response;
      throw new Error(String(data.error || 'no response').slice(0, 120));
    } catch (error) {
      console.warn(`retry ${attempt + 1}: ${error.message} · ${String(params.q).slice(-90)}`);
      if (attempt === 7) throw error;
      await sleep(2000 * 2 ** attempt);
    }
  }
}
const count = q => search({ q, rows: '0' }).then(r => r.numFound);
const quote = id => `"${String(id).replace(/["\\]/g, '\\$&')}"`;
export const drawerQuery = (base, prefix, lo, hi) => `${base} AND identifier:${prefix}*${lo ? ` AND identifier:[${quote(lo)} TO *]` : ''}${hi ? ` AND NOT identifier:[${quote(hi)} TO *]` : ''}`;

async function chain(prefix) {
  const drawers = [];
  const total = await count(`${QUERY} AND identifier:${prefix}*`);
  let lo = null, seen = 0;
  while (seen < total) {
    const r = await search({ q: drawerQuery(QUERY, prefix, lo, null), rows: '1', page: String(PAGE_LIMIT), 'fl[]': 'identifier', 'sort[]': 'identifier asc' });
    const hi = r.docs?.[0]?.identifier || null;
    const n = hi ? PAGE_LIMIT - 1 : r.numFound;
    drawers.push([prefix, lo, hi, n]);
    seen += n;
    if (!hi) break;
    lo = hi;
    if (drawers.length % 25 === 0) console.log(`  ${prefix}: ${seen}/${total}`);
  }
  const sum = drawers.reduce((a, d) => a + d[3], 0);
  return { prefix, total, sum, drawers };
}

const partialPath = OUT + '.partial.json';
const done = new Map();
try { for (const c of JSON.parse(await readFile(partialPath, 'utf8'))) done.set(c.prefix, c); } catch {}
const started = Date.now();
const grandTotal = await count(QUERY);
const todo = [...'abcdefghijklmnopqrstuvwxyz0123456789'].filter(p => !done.has(p));
console.log(`query: ${QUERY}\ntotal ${grandTotal}, chains to build ${todo.length}/36`);
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < todo.length) {
    const prefix = todo[next++];
    const t = Date.now(), result = await chain(prefix);
    done.set(prefix, result);
    await writeFile(partialPath, JSON.stringify([...done.values()]));
    console.log(`${prefix}: ${result.drawers.length} drawers, ${result.sum}/${result.total} items, ${Math.round((Date.now() - t) / 1000)}s · ${done.size}/36 · ${requests} requests`);
  }
}));

const chains = [...'abcdefghijklmnopqrstuvwxyz0123456789'].map(p => done.get(p));
const drawers = chains.flatMap(c => c.drawers);
const sum = drawers.reduce((a, d) => a + d[3], 0);
const index = { query: QUERY, builtAt: new Date().toISOString(), pageLimit: PAGE_LIMIT, total: sum, liveTotalAtBuild: grandTotal, drawers };
await writeFile(OUT + '.tmp', JSON.stringify(index));
await rename(OUT + '.tmp', OUT);
console.log(`done: ${drawers.length} drawers, ${sum} items in drawers vs ${grandTotal} live (${(sum - grandTotal)} drift), ${requests} requests, ${Math.round((Date.now() - started) / 60000)} min → ${OUT}`);
