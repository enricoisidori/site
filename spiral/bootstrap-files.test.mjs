import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
test('startup pack supplies at least ten unique short files within a small total download',async()=>{
 const items=JSON.parse(await readFile(new URL('./bootstrap-videos.json',import.meta.url)));
 assert.ok(items.length>=10);
 assert.equal(new Set(items.map(item=>item.id)).size,items.length);
 assert.ok(items.reduce((sum,item)=>sum+item.bytes,0)<3*1024*1024);
 for(const item of items){
  assert.ok(item.duration>=4 && item.duration<=20.2);
  assert.ok(item.urls[0].startsWith('./bootstrap-clips/'));
  assert.equal((await stat(new URL(item.urls[0],import.meta.url))).size,item.bytes);
 }
});
