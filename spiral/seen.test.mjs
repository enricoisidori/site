import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeenVideos } from './seen.js';
const memory = () => { const data = new Map(); return { getItem:k=>data.get(k), setItem:(k,v)=>data.set(k,v) }; };
test('first video remains excluded beyond both old history limits and after reload', () => {
  const storage = memory();
  const seen = createSeenVideos(storage);
  for (let i=0;i<1000;i++) seen.add(`video-${i}`);
  assert.equal(seen.size,1000);
  assert.equal(seen.has('video-0'),true);
  assert.equal(createSeenVideos(storage).has('video-0'),true);
});
test('players synchronize history rather than overwrite each other', () => {
  const storage = memory();
  const spiral = createSeenVideos(storage), dream = createSeenVideos(storage);
  spiral.add('a'); assert.equal(dream.has('a'),true);
  dream.add('b'); assert.equal(spiral.has('b'),true);
  assert.equal(createSeenVideos(storage).size,2);
});
test('unavailable or corrupted storage retains session exclusions', () => {
  const seen = createSeenVideos({getItem(){throw Error();},setItem(){throw Error();}});
  seen.add('a'); assert.equal(seen.has('a'),true);
  const malformed = createSeenVideos({getItem:()=>'{bad',setItem(){}});
  malformed.add('b'); assert.equal(malformed.has('b'),true);
});

test('claim refuses a video already reserved by either player',async()=>{
 const storage=memory(); const first=createSeenVideos(storage),second=createSeenVideos(storage);
 assert.equal(await first.claim('clip'),true);
 assert.equal(await second.claim('clip'),false);
});

test('identical media is rejected even under a different archive identifier',async()=>{
 const seen=createSeenVideos(memory());
 assert.equal(await seen.claim(['first-id','sha256:same-file']),true);
 assert.equal(await seen.claim(['mirror-id','sha256:same-file']),false);
 assert.equal(seen.has('mirror-id'),false);
});
