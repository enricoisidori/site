import test from 'node:test';
import assert from 'node:assert/strict';
import { captionTerms, highlightParts } from '../terms.js';
import { queryFor, metadataMatches, streamableFiles, durationSeconds, randomPage, SORTS, search } from '../archive.js';
import { hasBuffer, nearestScene } from '../media.js';
import { CandidatePool, Semaphore } from '../pool.js';

test('keyword concrete e frasi composte dalla descrizione', () => {
  assert.deepEqual(captionTerms('A man is standing beside a red fire truck on a city street.'), ['fire truck', 'city street']);
  assert.deepEqual(captionTerms('a blurry black and white image'), []);
});
test('query solo titolo, nessuna collezione, peso totale o popolarità', () => {
  const q = queryFor(['car', 'car', '" OR *:*']);
  assert.ok(q.includes('title:"car"'));
  assert.ok(!/subject:|description:|collection:|item_size:|identifier:/.test(q));
  assert.ok(!q.includes('*:*'));
  assert.equal((q.match(/title:"car"/g) || []).length, 1);
  assert.ok(SORTS.every(s => !/downloads|views|relevance/.test(s)));
});
test('finestra 10k e ultima pagina inclusa, senza suddivisioni aggiuntive', () => {
  assert.equal(randomPage(101, () => .99999), 3);
  assert.equal(randomPage(500000, () => .99999), 200);
  assert.equal(randomPage(500000, () => 0), 1);
});
test('avvio generale in una sola richiesta di ricerca', async () => {
  const original = globalThis.fetch; const urls = [];
  globalThis.fetch = async url => { urls.push(url); return { ok: true, json: async () => ({ response: { numFound: 12000000, docs: [{ identifier: 'random-movie' }] } }) }; };
  try {
    const result = await search([], new AbortController().signal);
    assert.equal(urls.length, 1);
    assert.ok(!new URL(urls[0]).searchParams.get('q').includes('identifier:'));
    assert.equal(result.items[0].identifier, 'random-movie');
  } finally { globalThis.fetch = original; }
});
test('match ed evidenziazione non confondono car e cartoon', () => {
  assert.deepEqual(metadataMatches({ title: 'Cartoons', subject: ['street', 'car'] }, ['car']), []);
  assert.deepEqual(metadataMatches({ title: 'A car on the street', subject: [] }, ['car']), [{ field: 'title', text: 'A car on the street', terms: ['car'] }]);
  assert.deepEqual(highlightParts('A car and a cartoon', ['car']), [{ text: 'A ', match: false }, { text: 'car', match: true }, { text: ' and a cartoon', match: false }]);
});
test('filmati di almeno 30s e derivati leggeri, senza limite sul file lungo', () => {
  const good = { name: 'long_512kb.mp4', size: 100000000, length: 1600, height: 240, format: '512Kb MPEG4' };
  assert.deepEqual(streamableFiles([good, { ...good, length: 20 }, { ...good, private: true }, { ...good, height: 1080 }]), [good]);
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
test('i preparatori condividono la pagina e prendono candidati distinti', async () => {
  const original = globalThis.fetch; let requests = 0;
  globalThis.fetch = async () => { requests++; await new Promise(r => setTimeout(r, 5)); return { ok: true, json: async () => ({ response: { numFound: 12000000, docs: [{ identifier: 'a' }, { identifier: 'b' }, { identifier: 'c' }] } }) }; };
  try {
    const pool = new CandidatePool([], new AbortController().signal);
    const results = await Promise.all([pool.take(() => false), pool.take(() => false), pool.take(() => false)]);
    assert.equal(requests, 1);
    assert.equal(new Set(results.map(r => r.candidate.identifier)).size, 3);
  } finally { globalThis.fetch = original; }
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
