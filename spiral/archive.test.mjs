import test from 'node:test';
import assert from 'node:assert/strict';
import { searchQuery, playableFiles, searchTerms, shuffle, candidates, metadataMatches, searchPlan, videoTerms, videoQuery, videoCandidates, archiveMediaURL, resolveItem } from './archive.js';

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
test('video search uses the whole movie catalog and a short list of useful keywords', () => {
  assert.ok(!videoQuery('cellular phone').includes('collection:'));
  assert.ok(videoQuery('cellular phone').includes('title:"cellular phone" OR description:"cellular phone"'));
  assert.deepEqual(videoTerms([
    {label:'cash machine, cash dispenser, automatic teller, ATM',score:.477},
    {label:'cellular telephone, cellular phone, cellphone, cell, mobile phone',score:.277},
    {label:'screen',score:.036},
  ]), ['cash machine','atm','cellular telephone','telephone','phone']);
});
test('video query takes first relevance results and exposes the real total', async () => {
  const original = globalThis.fetch;
  let url;
  try {
    globalThis.fetch = async value => { url = value; return {ok:true,json:async()=>({response:{numFound:80,docs:[{identifier:'phone'}]}})}; };
    const result = await videoCandidates('cellular phone');
    assert.equal(result.total,80);
    assert.equal(result.items[0].identifier,'phone');
    const params = new URL(url,'http://local').searchParams;
    assert.equal(params.get('page'),'1');
    assert.equal(new URL(url).origin,'https://archive.org');
    assert.equal(new URL(url).pathname,'/advancedsearch.php');
    assert.equal(params.get('output'),'json');
    assert.equal(params.get('fl[]'),'identifier');
    assert.equal(params.has('sort[]'),false);
  } finally { globalThis.fetch = original; }
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


test('static hosting uses official CORS media and metadata endpoints', async () => {
  assert.equal(archiveMediaURL('film-id', 'a b/clip ü.mp4'), 'https://archive.org/cors/film-id/a%20b/clip%20%C3%BC.mp4');
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      assert.equal(url, 'https://archive.org/metadata/film-id');
      return {ok:true,json:async()=>({metadata:{title:'Film'},files:[{name:'clip.mp4',size:'12000'}]})};
    };
    const item = await resolveItem({identifier:'film-id'});
    assert.deepEqual(item.urls,['https://archive.org/cors/film-id/clip.mp4']);
  } finally { globalThis.fetch = original; }
});

test('drifting search can continue beyond the first results page', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      assert.equal(new URL(url).searchParams.get('page'),'4');
      return {ok:true,json:async()=>({response:{numFound:100,docs:[]}})};
    };
    await videoCandidates('phone', undefined, 4);
  } finally { globalThis.fetch = original; }
});
