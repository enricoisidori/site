#!/usr/bin/env node
// Checks that the coverage copies draw uniformly from the whole archives.
//   node tools/validate-coverage.mjs archive [draws=600] [index=afterimage/partition.json]
//   node tools/validate-coverage.mjs commons [batches=20]
// Archive: every draw must fall inside its drawer's dates, draws must not repeat,
// and the distribution by year must match the whole index (χ² test).
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

const iso = seconds => new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
const year = seconds => new Date(seconds * 1000).getUTCFullYear();
// Same draw as afterimage/archive.js: a drawer by size, then the item
// at a uniform position inside it, with one rows=1 request.
async function archive(draws, path) {
  const index = JSON.parse(await readFile(path, 'utf8'));
  const starts = []; let dated = 0; for (const d of index.drawers) { starts.push(dated); dated += d[1]; }
  const end = i => i + 1 < index.drawers.length ? index.drawers[i + 1][0] - 1 : index.end;
  // Drawers never cross a quarter, so each one belongs to a single year.
  const share = {}; for (const d of index.drawers) share[year(d[0])] = (share[year(d[0])] || 0) + d[1] / dated;
  const observed = {}, ids = new Set(), times = []; let outside = 0, empty = 0, done = 0;
  const one = async () => {
    const r = Math.floor(Math.random() * dated);
    let a = 0, b = starts.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (starts[m] <= r) a = m; else b = m - 1; }
    const [from, count] = index.drawers[a], offset = r - starts[a], desc = offset >= 10000;
    const started = Date.now();
    const params = new URLSearchParams({ q: `${index.query} AND publicdate:[${iso(from)} TO ${iso(end(a))}]`, rows: '1', page: String(desc ? count - offset : offset + 1), output: 'json', 'sort[]': `publicdate ${desc ? 'desc' : 'asc'}` });
    params.append('fl[]', 'identifier'); params.append('fl[]', 'publicdate');
    const data = await get('https://archive.org/advancedsearch.php?' + params);
    times.push(Date.now() - started);
    const doc = data.response?.docs?.[0];
    if (!doc) { empty++; return; }
    const t = Date.parse(doc.publicdate) / 1000;
    if (t < from || t > end(a)) outside++;
    ids.add(doc.identifier); observed[year(from)] = (observed[year(from)] || 0) + 1;
    if (++done % 100 === 0) console.log(`${done}/${draws}`);
  };
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => { while (next++ < draws) await one(); }));
  // Years too small for the test are merged into one bucket.
  const n = Object.values(observed).reduce((a, b) => a + b, 0), merged = {}, mergedShare = {};
  for (const [y, p] of Object.entries(share)) { const k = p * n < 5 ? 'small' : y; mergedShare[k] = (mergedShare[k] || 0) + p; merged[k] = (merged[k] || 0) + (observed[y] || 0); }
  const x2 = chi(merged, mergedShare, n), df = Object.keys(mergedShare).length - 1;
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ indexBuilt: index.builtAt, indexTotal: index.total, draws: n, distinct: ids.size, outsideDrawer: outside, emptyDraws: empty, latencyMs: { p50: times[times.length >> 1], p90: times[Math.floor(times.length * .9)], max: times.at(-1) }, chi2ByYear: +x2.toFixed(1), critical05: +critical(df).toFixed(1), uniform: x2 < critical(df) }, null, 1));
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
if (mode === 'archive') await archive(Number(count) || 600, path || 'afterimage/partition.json');
else if (mode === 'commons') await commons(Number(count) || 20);
else console.log('usage: validate-coverage.mjs archive|commons [count] [index]');
