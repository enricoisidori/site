import test from 'node:test';
import assert from 'node:assert/strict';
import { searchQuery, playableFiles, searchTerms, shuffle, candidates, metadataMatches, searchPlan } from './archive.js';

test('search terms cannot inject archive query operators', () => {
  const query = searchQuery('dog) OR collection:other *');
  assert.ok(query.includes('collection:prelinger'));
  assert.ok(query.endsWith('subject:"dog or collection other")'));
});
test('multiword searches use a phrase rather than independent OR words', () => {
  assert.ok(searchQuery('computer keyboard').includes('description:"computer keyboard"'));
});
test('report the actual matching field without inventing a title match', () => {
  const matches = metadataMatches({ title: 'Better Work Methods', description: '<p>Bolt + washer assembly</p>' }, 'washer');
  assert.equal(matches[0].field, 'Descrizione');
  assert.equal(matches[0].keyword, 'washer');
  assert.equal(matches[0].before + matches[0].keyword + matches[0].after, ' Bolt + washer assembly ');
  assert.deepEqual(metadataMatches({ title: 'Unrelated' }, 'washer'), []);
});
test('only public MP4 files, bandwidth-friendly derivation first', () => {
  const files = playableFiles([
    { name: 'big.mp4', size: '900000', format: 'h.264' },
    { name: 'hidden.mp4', size: '100000', private: true },
    { name: 'film.mpeg', size: '100000' },
    { name: 'film_512kb.mp4', size: '300000' },
  ]);
  assert.deepEqual(files.map(f => f.name), ['film_512kb.mp4', 'big.mp4']);
});
test('broaden recognition and reject low-confidence labels', () => {
  assert.deepEqual(searchTerms([{ label: 'Norfolk terrier', score: .8 }, { label: 'cat', score: .01 }]), ['norfolk terrier', 'dog']);
  assert.deepEqual(searchTerms([]), []);
});
test('search every keyword in titles before any description or subjects; no random fallback', () => {
  assert.deepEqual(searchPlan(['dog', 'cat']), [
    {term:'dog',field:'title'}, {term:'cat',field:'title'},
    {term:'dog',field:'description'}, {term:'cat',field:'description'},
    {term:'dog',field:'subject'}, {term:'cat',field:'subject'},
  ]);
  assert.deepEqual(searchPlan([]), []);
  assert.deepEqual(searchPlan([], true), [{term:'',field:''}]);
  assert.ok(searchQuery('dog','title').endsWith('AND (title:"dog")'));
});
test('matching must be a complete word, not an accidental substring', () => {
  assert.deepEqual(metadataMatches({title:'Carpet weaving'},'car'), []);
  assert.equal(metadataMatches({title:'A car in traffic'},'car')[0].keyword, 'car');
});
test('exclude short and oversized films but defer unknown durations to player', () => {
  const files = playableFiles([
    { name: 'short.mp4', size: '100000', length: '3.9' },
    { name: 'long.mp4', size: '100000', length: '4' },
    { name: 'unknown.mp4', size: '100000' },
    { name: 'huge.mp4', size: String(81 * 1024 * 1024), length: '90' },
  ]);
  assert.deepEqual(files.map(f => f.name), ['long.mp4', 'unknown.mp4']);
});
test('shuffle preserves source and members', () => {
  const source = [1, 2, 3, 4];
  assert.deepEqual(shuffle(source).sort(), source);
  assert.deepEqual(source, [1, 2, 3, 4]);
});
test('random sampling queries a valid catalog page and handles empty results', async () => {
  const original = globalThis.fetch;
  const urls = [];
  try {
    globalThis.fetch = async url => {
      urls.push(url);
      return { ok: true, json: async () => ({ response: { numFound: 41, docs: [{ identifier: 'a' }] } }) };
    };
    assert.equal((await candidates()).length, 1);
    const page = new URL(urls[1], 'http://local').searchParams.get('page');
    assert.ok(Number(page) >= 1 && Number(page) <= 3);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ response: { numFound: 0 } }) });
    assert.deepEqual(await candidates('unknown'), []);
  } finally { globalThis.fetch = original; }
});
