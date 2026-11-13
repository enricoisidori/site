import test from 'node:test';
import assert from 'node:assert/strict';
import { captionTerms, highlightParts } from '../terms.js';
globalThis.location={protocol:'https:'};
const { queryFor, metadataMatches, streamableFiles, durationSeconds, SORTS, search, drawOne, prefetchKeyword } = await import('../archive.js');
const { hasBuffer, nearestScene, pickScene } = await import('../media.js');
import { CandidatePool, Semaphore } from '../pool.js';
import { resetArchiveBudget } from '../archive-transport.js';

test('keyword concrete e frasi composte dalla descrizione', () => {
  assert.deepEqual(captionTerms('A man is standing beside a red fire truck on a city street.'), ['fire truck', 'city street', 'man']);
  assert.deepEqual(captionTerms('a blurry black and white image'), []);
});
test('query solo titolo, esclusioni di collezioni senza restringere a una collezione', () => {
  const q = queryFor(['car', 'car', '" OR *:*']);
  assert.ok(q.includes('title:"car"'));
  assert.ok(!/subject:|description:|item_size:|identifier:/.test(q));
  assert.ok(q.includes('NOT collection:'));
  assert.ok(!q.includes(' AND collection:'));
  assert.ok(!q.includes('*:*'));
  assert.equal((q.match(/title:"car"/g) || []).length, 1);
  assert.ok(SORTS.every(s => !/downloads|views|relevance/.test(s)));
});
test('match ed evidenziazione non confondono car e cartoon', () => {
  assert.deepEqual(metadataMatches({ title: 'Cartoons', subject: ['street', 'car'] }, ['car']), []);
  assert.deepEqual(metadataMatches({ title: 'A car on the street', subject: [] }, ['car']), [{ field: 'title', text: 'A car on the street', terms: ['car'] }]);
  assert.deepEqual(highlightParts('A car and a cartoon', ['car']), [{ text: 'A ', match: false }, { text: 'car', match: true }, { text: ' and a cartoon', match: false }]);
});
test('derivati leggeri, anche filmati brevi, senza limite sul file lungo', () => {
  const good = { name: 'long_512kb.mp4', size: 100000000, length: 1600, height: 240, format: '512Kb MPEG4' };
  assert.deepEqual(streamableFiles([good, { ...good, length: 20 }, { ...good, private: true }, { ...good, height: 1080 }]), [good, {...good,length:20}]);
  assert.equal(durationSeconds('01:02:30'), 3750);
  assert.equal(durationSeconds('00:00:29'), 29);
});
test('buffer continuo, senza contare intervalli separati', () => {
  const video = ranges => ({ duration: 90, currentTime: 10, buffered: { length: ranges.length, start: i => ranges[i][0], end: i => ranges[i][1] } });
  assert.ok(hasBuffer(video([[10, 35]]), 10, 12));
  assert.ok(!hasBuffer(video([[10, 20], [21, 40]]), 10, 12));
});
test('scena dello stesso file e tempo più vicino', () => {
  const item = { filename: 'boat_512kb.mp4', original: 'boat.mpeg', frames: [
    { stem: 'other', time: 20, name: 'other.jpg' }, { stem: 'boat', time: 10, name: 'boat10.jpg' }, { stem: 'boat', time: 30, name: 'boat30.jpg' },
  ] };
  assert.equal(nearestScene(item, 22).name, 'boat30.jpg');
  assert.equal(nearestScene({ ...item, original: 'missing.mpeg', filename: 'missing.mp4' }, 22), undefined);
});
test('la concorrenza media è limitata e una prenotazione annullata non blocca la coda', async () => {
  const gate = new Semaphore(2); let running = 0, peak = 0;
  const task = async () => { running++; peak = Math.max(peak, running); await new Promise(r => setTimeout(r, 15)); running--; };
  const signal = new AbortController().signal;
  const first = gate.run(task, signal), second = gate.run(task, signal);
  const cancel = new AbortController();
  const third = gate.run(task, cancel.signal); cancel.abort();
  await assert.rejects(third);
  await Promise.all([first, second, gate.run(task, signal)]);
  assert.equal(peak, 2); assert.equal(gate.used, 0);
});

// ---- uniform draw / keyword search / scenes, with a mocked Archive -------------
const INDEX = { query: 'mediatype:movies AND NOT access-restricted-item:true', total: 20157, end: 1300000000, undated: 7,
  drawers: [[1000000000, 100], [1100000000, 20000], [1200000000, 50]] };
const DATED = 20150, TOTAL = 20157;
const iso = s => new Date(s * 1000).toISOString().replace('.000Z', 'Z');
const reply = body => ({ ok: true, json: async () => body });
function mockArchive(t, handler) {
  resetArchiveBudget();
  const calls = [], original = globalThis.fetch;
  globalThis.fetch = async u => {
    const s = String(u);
    if (s.includes('partition.json')) return reply(structuredClone(INDEX));
    const p = new URL(s).searchParams;
    const call = { q: p.get('q'), rows: p.get('rows'), page: p.get('page'), sort: p.get('sort[]') };
    calls.push(call);
    if (call.rows === '0' && call.q.endsWith(' TO *]') && !call.q.includes('title:')) return reply({ response: { numFound: 0, docs: [] } });  // videos newer than the index
    return reply(handler(call));
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}
function fixRandom(t, value) { const original = Math.random; Math.random = () => value; t.after(() => { Math.random = original; }); }
const atRank = rank => (rank + .5) / TOTAL;
const oneDoc = () => ({ response: { numFound: 1, docs: [{ identifier: 'drawn', title: 'x', collection: ['community'] }] } });
const drawCalls = calls => calls.filter(c => c.rows === '1');

test('estrazione uniforme: finestra publicdate e pagina dal rango, primo cassetto', async t => {
  const calls = mockArchive(t, oneDoc); fixRandom(t, atRank(5));
  const r = await drawOne([], new AbortController().signal);
  const [c] = drawCalls(calls);
  assert.equal(drawCalls(calls).length, 1);
  assert.equal(c.page, '6'); assert.equal(c.sort, 'publicdate asc');
  assert.equal(c.q, `${INDEX.query} AND publicdate:[${iso(1000000000)} TO ${iso(1100000000 - 1)}]`);
  assert.equal(r.item.identifier, 'drawn'); assert.equal(r.total, TOTAL);
});
test('estrazione uniforme: secondo cassetto, offset sopra 10000 letto in ordine inverso', async t => {
  const calls = mockArchive(t, oneDoc); fixRandom(t, atRank(100 + 50));
  await drawOne([], new AbortController().signal);
  let c = drawCalls(calls).at(-1);
  assert.equal(c.page, '51'); assert.equal(c.sort, 'publicdate asc');
  assert.equal(c.q, `${INDEX.query} AND publicdate:[${iso(1100000000)} TO ${iso(1200000000 - 1)}]`);
  Math.random = () => atRank(100 + 15000);
  await drawOne([], new AbortController().signal);
  c = drawCalls(calls).at(-1);
  assert.equal(c.page, String(20000 - 15000)); assert.equal(c.sort, 'publicdate desc');
});
test('estrazione uniforme: ultimo cassetto termina a index.end, cassetto senza data per identificatore', async t => {
  const calls = mockArchive(t, oneDoc); fixRandom(t, atRank(100 + 20000 + 2));
  await drawOne([], new AbortController().signal);
  let c = drawCalls(calls).at(-1);
  assert.equal(c.page, '3');
  assert.equal(c.q, `${INDEX.query} AND publicdate:[${iso(1200000000)} TO ${iso(INDEX.end)}]`);
  Math.random = () => atRank(DATED + 3);
  await drawOne([], new AbortController().signal);
  c = drawCalls(calls).at(-1);
  assert.equal(c.page, '4'); assert.equal(c.sort, 'identifier asc');
  assert.ok(c.q.startsWith(INDEX.query + ' AND NOT publicdate:['));
});
test('l\'estrazione conta una volta i video più recenti dell\'indice', async t => {
  const calls = mockArchive(t, c => c.rows === '0' ? { response: { numFound: 0, docs: [] } } : oneDoc()); fixRandom(t, atRank(5));
  await drawOne([], new AbortController().signal); await new Promise(r => setImmediate(r));
  const tails = calls.filter(c => c.rows === '0');
  assert.ok(tails.length <= 1);
  if (tails.length) assert.equal(tails[0].q, `${INDEX.query} AND publicdate:[${iso(INDEX.end + 1)} TO *]`);
});
test('una collezione bloccata dà item null', async t => {
  fixRandom(t, atRank(5));
  mockArchive(t, () => ({ response: { numFound: 1, docs: [{ identifier: 'news', collection: ['community', 'tvnews'] }] } }));
  assert.equal((await drawOne([], new AbortController().signal)).item, null);
  mockArchive(t, () => ({ response: { numFound: 1, docs: [{ identifier: 'game', collection: 'gamevideos' }] } }));
  assert.equal((await drawOne([], new AbortController().signal)).item, null);
  mockArchive(t, () => ({ response: { numFound: 1, docs: [{ identifier: 'ok', collection: ['prelinger'] }] } }));
  assert.equal((await drawOne([], new AbortController().signal)).item.identifier, 'ok');
});
test('search([]) fa tre estrazioni indipendenti e scarta le bloccate', async t => {
  fixRandom(t, atRank(5)); let n = 0;
  mockArchive(t, () => { n++; return { response: { numFound: 1, docs: [{ identifier: 'd' + n, collection: n === 2 ? ['tvnews'] : [] }] } }; });
  const r = await search([], new AbortController().signal);
  assert.equal(r.sort, 'uniforme'); assert.equal(r.total, TOTAL);
  assert.deepEqual(r.items.map(i => i.identifier).sort(), ['d1', 'd3']);
});
test('i preparatori condividono una ricerca e prendono candidati distinti', async t => {
  fixRandom(t, atRank(5)); let n = 0;
  const calls = mockArchive(t, () => ({ response: { numFound: 1, docs: [{ identifier: 'c' + ++n }] } }));
  const pool = new CandidatePool([], new AbortController().signal);
  const results = await Promise.all([pool.take(() => false), pool.take(() => false), pool.take(() => false)]);
  assert.equal(drawCalls(calls).length, 3);
  assert.equal(new Set(results.map(r => r.candidate.identifier)).size, 3);
});

const keywordDocs = (from, n) => Array.from({ length: n }, (_, i) => ({ identifier: 'k' + (from + i), title: 'a truck, a boat, a plane and a ship', collection: [] }));
// random 0.25: the instant falls in the second drawer, and the first side is 'asc'
const MOMENT = (() => { const rank = Math.floor(.25 * DATED); return Math.round(1100000000 + (rank - 100) / 20000 * (1200000000 - 1 - 1100000000)); })();
const sideCalls = calls => calls.filter(c => c.rows === '50');
test('parola chiave: una sola richiesta quando arrivano 50 documenti', async t => {
  fixRandom(t, .25);
  const calls = mockArchive(t, c => ({ response: { numFound: 900, docs: c.rows === '50' ? keywordDocs(0, 50) : [] } }));
  const r = await search(['truck'], new AbortController().signal);
  const sides = sideCalls(calls);
  assert.equal(sides.length, 1);
  assert.equal(sides[0].page, '1'); assert.equal(sides[0].sort, 'publicdate asc');
  assert.equal(sides[0].q, `${INDEX.query} AND (title:"truck") AND publicdate:[${iso(MOMENT)} TO *]`);
  assert.equal(r.items.length, 50); assert.equal(r.total, 900); assert.equal(r.sort, 'publicdate asc');
});
test('parola chiave: meno di 50 documenti chiede l\'altro verso e unisce senza duplicati', async t => {
  fixRandom(t, .25);
  const calls = mockArchive(t, c => c.sort === 'publicdate asc'
    ? { response: { numFound: 3, docs: keywordDocs(0, 3) } }
    : { response: { numFound: 4, docs: keywordDocs(2, 4) } });
  const r = await search(['boat'], new AbortController().signal);
  const sides = sideCalls(calls);
  assert.equal(sides.length, 2);
  assert.equal(sides[1].sort, 'publicdate desc');
  assert.equal(sides[1].q, `${INDEX.query} AND (title:"boat") AND publicdate:[* TO ${iso(MOMENT)}]`);
  assert.deepEqual(r.items.map(i => i.identifier).sort(), ['k0', 'k1', 'k2', 'k3', 'k4', 'k5']);
  assert.equal(r.total, 7);
});
test('parola chiave: i documenti in collezioni bloccate non diventano candidati', async t => {
  fixRandom(t, .25);
  mockArchive(t, c => ({ response: { numFound: 2, docs: [{ identifier: 'a', title: 'plane', collection: ['tvnews'] }, { identifier: 'b', title: 'plane', collection: ['x'] }, { identifier: 'c', title: 'planes', collection: ['x'] }] } }));
  const r = await search(['plane'], new AbortController().signal);
  assert.deepEqual(r.items.map(i => i.identifier), ['b']);
});
test('prefetchKeyword: il risultato anticipato è riusato una sola volta', async t => {
  fixRandom(t, .25);
  const calls = mockArchive(t, c => ({ response: { numFound: 60, docs: c.rows === '50' ? keywordDocs(0, 50) : [] } }));
  const signal = new AbortController().signal;
  prefetchKeyword(['ship']);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(sideCalls(calls).length, 1);          // started before any search()
  const first = await search(['ship'], signal);
  assert.equal(sideCalls(calls).length, 1);          // reused, no new request
  assert.equal(first.items.length, 50);
  await search(['ship'], signal);
  assert.equal(sideCalls(calls).length, 2);          // consumed: the next one is fresh
});

test('pickScene: salta la prima miniatura a 1 s o meno, se ce ne sono altre', () => {
  const frames = times => times.map(time => ({ stem: 'boat', time, name: `b${time}.jpg` }));
  const item = (times, duration = 120) => ({ filename: 'boat_512kb.mp4', original: 'boat.mpeg', duration, frames: frames(times) });
  assert.equal(pickScene(item([0, 10, 50]), { startup: true }).time, 10);
  assert.equal(pickScene(item([1, 10]), { startup: true }).time, 10);
  assert.equal(pickScene(item([0]), { startup: true }).time, 0);
  assert.equal(pickScene(item([2, 10]), { startup: true }).time, 2);
});
test('pickScene: preferisce scene che lasciano 30 s, scarta quelle a fine file, null senza scene', t => {
  const frames = times => times.map(time => ({ stem: 'boat', time, name: `b${time}.jpg` }));
  const item = (times, duration) => ({ filename: 'boat_512kb.mp4', original: 'boat.mpeg', duration, frames: frames(times) });
  assert.equal(pickScene(item([10, 60, 90], 100), { startup: true }).time, 10);
  assert.equal(pickScene(item([85, 90], 100), { startup: true }).time, 85);       // none roomy: keep all
  assert.equal(pickScene(item([85, 99], 100), { startup: true }).time, 85);       // 99 s is within 2 s of the end
  assert.equal(pickScene(item([99], 100), { startup: true }), null);
  assert.equal(pickScene(item([0, 5, 90], 100), { startup: true }).time, 5);      // roomy first, then skip the opening
  assert.equal(pickScene({ filename: 'x.mp4', frames: [] }, { startup: true }), null);
  assert.equal(pickScene({ filename: 'x.mp4', duration: 100, frames: [{ stem: 'other', time: 10, name: 'o.jpg' }] }, { startup: true }), null);
  const original = Math.random; t.after(() => { Math.random = original; });
  Math.random = () => 0; assert.equal(pickScene(item([10, 40, 60], 100)).time, 10);
  Math.random = () => .99; assert.equal(pickScene(item([10, 40, 60], 100)).time, 60);
  Math.random = () => .99; assert.equal(pickScene(item([10, 40, 90], 100)).time, 40); // 90 not roomy
});
test('pickScene: middle sceglie la più vicina a metà durata', () => {
  const it = { filename: 'boat.mp4', duration: 100, frames: [10, 45, 90].map(time => ({ stem: 'boat', time, name: `b${time}.jpg` })) };
  assert.equal(pickScene(it, { middle: true }).time, 45);
  assert.equal(pickScene({ ...it, frames: [...it.frames, { stem: 'boat', time: 51, name: 'b51.jpg' }] }, { middle: true }).time, 51);
});
test('streamableFiles rispetta i limiti di bitrate e altezza', () => {
  const f = { name: 'a.mp4', size: 25000000, length: 100, height: 480, format: 'h.264' };        // 2 Mbps
  assert.deepEqual(streamableFiles([f]), []);
  assert.deepEqual(streamableFiles([f], { maxBitrate: 3000000 }), [f]);
  const hd = { name: 'hd.mp4', size: 10000000, length: 100, height: 1080, format: 'h.264' };       // 0.8 Mbps
  assert.deepEqual(streamableFiles([hd]), []);
  assert.deepEqual(streamableFiles([hd], { maxHeight: 1080 }), [hd]);
  const small = { ...f, format: '512Kb MPEG4', height: 800 };
  assert.deepEqual(streamableFiles([small]), []);
  assert.deepEqual(streamableFiles([small], { maxHeight: 800 }), [small]);
});

test('bande nere incise: rilevate ai lati, non su un fotogramma tutto nero', async () => {
  const { barsOf } = await import('../media.js');
  const frame = (w, h, inside) => { const data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, v = inside(x, y) ? 140 : 0; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; } return { getImageData: () => ({ data }) }; };
  const pillar = barsOf(frame(100, 50, x => x >= 12 && x < 88), 100, 50);
  assert.equal(pillar.x, .12); assert.equal(pillar.y, 0);
  const letter = barsOf(frame(100, 50, (x, y) => y >= 5 && y < 45), 100, 50);
  assert.equal(letter.y, .1); assert.equal(letter.x, 0);
  assert.deepEqual(barsOf(frame(40, 30, () => false), 40, 30), { x: 0, y: 0 });
});
