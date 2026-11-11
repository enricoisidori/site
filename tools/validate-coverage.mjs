#!/usr/bin/env node
// Checks that the coverage copies draw uniformly from the whole archives.
//   node tools/validate-coverage.mjs archive [draws=600] [index=afterimage-coverage/partition.json]
//   node tools/validate-coverage.mjs commons [batches=20]
// Archive: every draw must fall inside its drawer bounds, draws must not repeat,
// and the leading-character distribution must match the index (χ² test).
// Commons: batches must differ and mime shares must match the index totals.
import { readFile } from 'node:fs/promises';

const UA = { 'User-Agent': 'enricoisidori.com coverage validation (contact: site owner)' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function get(url) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (response.status === 429 || response.status >= 500) throw new Error('HTTP ' + response.status);
      return await response.json();
    } catch (error) { if (attempt === 7) throw error; await sleep(2000 * 2 ** attempt); }
  }
}
// χ² critical values at p = .05.
const critical = df => df + 1.645 * Math.sqrt(2 * df) + 0.6;
const chi = (observed, expectedShare, n) => Object.keys(expectedShare).reduce((sum, k) => { const e = n * expectedShare[k]; return sum + ((observed[k] || 0) - e) ** 2 / e; }, 0);

const quote = id => `"${String(id).replace(/["\\]/g, '\\$&')}"`;
async function archive(draws, path) {
  const index = JSON.parse(await readFile(path, 'utf8'));
  const starts = []; let total = 0; for (const d of index.drawers) { starts.push(total); total += d[3]; }
  const share = {}; for (const d of index.drawers) share[d[0]] = (share[d[0]] || 0) + d[3] / total;
  const drawerQuery = ([prefix, lo, hi]) => `${index.query} AND identifier:${prefix}*${lo ? ` AND identifier:[${quote(lo)} TO *]` : ''}${hi ? ` AND NOT identifier:[${quote(hi)} TO *]` : ''}`;
  const lower = s => s.toLowerCase();
  const observed = {}, ids = new Set(); let outside = 0, empty = 0, done = 0;
  const one = async () => {
    const r = Math.floor(Math.random() * total);
    let a = 0, b = starts.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (starts[m] <= r) a = m; else b = m - 1; }
    const drawer = index.drawers[a], offset = r - starts[a];
    const data = await get('https://archive.org/advancedsearch.php?' + new URLSearchParams({ q: drawerQuery(drawer), rows: '1', page: String(offset + 1), output: 'json', 'fl[]': 'identifier', 'sort[]': 'identifier asc' }));
    const id = data.response?.docs?.[0]?.identifier;
    if (!id) { empty++; return; }
    const [prefix, lo, hi] = drawer, k = lower(id);
    if (!k.startsWith(prefix) || lo && k < lower(lo) || hi && k >= lower(hi)) outside++;
    ids.add(id); observed[prefix] = (observed[prefix] || 0) + 1;
    if (++done % 100 === 0) console.log(`${done}/${draws}`);
  };
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (next++ < draws) await one(); }));
  const n = Object.values(observed).reduce((a, b) => a + b, 0), x2 = chi(observed, share, n), df = Object.keys(share).length - 1;
  console.log(JSON.stringify({ indexBuilt: index.builtAt, indexTotal: total, draws: n, distinct: ids.size, outsideDrawer: outside, emptyDraws: empty, chi2: +x2.toFixed(1), critical05: +critical(df).toFixed(1), uniform: x2 < critical(df) }, null, 1));
}

async function commons(batches) {
  const mimes = { 'image/jpeg': 121355585, 'image/png': 5616498, 'image/tiff': 4927829, 'image/gif': 413007, 'image/webp': 69259, 'image/svg+xml': 5319633 };
  const sum = Object.values(mimes).reduce((a, b) => a + b, 0), share = Object.fromEntries(Object.entries(mimes).map(([k, v]) => [k, v / sum]));
  const observed = {}, titles = new Set(); let n = 0;
  for (let i = 0; i < batches; i++) {
    // Same request as aleph-coverage/index.html.
    const data = await get('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: 'filetype:bitmap|drawing', gsrsort: 'random', gsrnamespace: '6', gsrlimit: '50', prop: 'imageinfo', iiprop: 'mime', requestid: String(Math.random()) }));
    for (const page of Object.values(data.query?.pages || {})) { n++; titles.add(page.title); const m = page.imageinfo?.[0]?.mime; if (m in mimes) observed[m] = (observed[m] || 0) + 1; }
    await sleep(2500);
  }
  const x2 = chi(observed, share, Object.values(observed).reduce((a, b) => a + b, 0));
  console.log(JSON.stringify({ items: n, distinct: titles.size, observed, chi2: +x2.toFixed(1), critical05: +critical(5).toFixed(1), uniform: x2 < critical(5) }, null, 1));
}

const [mode, count, path] = process.argv.slice(2);
if (mode === 'archive') await archive(Number(count) || 600, path || 'afterimage-coverage/partition.json');
else if (mode === 'commons') await commons(Number(count) || 20);
else console.log('usage: validate-coverage.mjs archive|commons [count] [index]');
