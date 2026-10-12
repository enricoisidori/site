import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {primeCatalog,catalogCandidates,catalogRecord} from './catalog.js';
test('global tiny originals remain available for startup without a remote metadata lookup',async()=>{
 const rows=JSON.parse(await readFile(new URL('./archive-catalog.json',import.meta.url)));
 const tiny=rows.filter(row=>row.scope==='archive-global' && row.files.some(f=>Number(f.size)<400000 && Number(f.length)>=4));
 assert.ok(tiny.length>=5);
 const previous=globalThis.fetch;
 try {
  globalThis.fetch=async()=>({ok:true,json:async()=>rows});
  await primeCatalog();
  globalThis.fetch=async()=>{throw new Error('Remote metadata unavailable');};
  const found=catalogCandidates(()=>true);
  for(const row of tiny) {
   assert.ok(found.some(item=>item.identifier===row.identifier));
   assert.equal(catalogRecord(row.identifier).identifier,row.identifier);
  }
 } finally {globalThis.fetch=previous;}
});
