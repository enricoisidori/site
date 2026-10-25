import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createBluenessMediaRelay,publicVideoURL} from '../blueness-media-relay.mjs';
async function using(fetchUpstream,run){const server=createBluenessMediaRelay({fetchUpstream});server.listen(0,'127.0.0.1');await once(server,'listening');try{await run('http://127.0.0.1:'+server.address().port);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
test('public video allowlist rejects private hosts, credentials and non-video paths',()=>{
 for(const url of ['http://archive.org/download/item/movie.mp4','https://127.0.0.1/movie.mp4','https://user:password@archive.org/download/item/movie.mp4','https://upload.wikimedia.org.attacker.test/wikipedia/commons/a.mp4','https://archive.org/metadata/item','https://archive.org/download/item/page.html'])assert.throws(()=>publicVideoURL(url));
 assert.equal(publicVideoURL('https://archive.org/cors/item/movie.mp4'),'https://archive.org/download/item/movie.mp4');
});
test('status works without contacting upstream',async()=>using(()=>{throw Error('unexpected fetch');},async base=>{const response=await fetch(base+'/status');assert.equal((await response.json()).service,'blueness-range-relay');}));
test('Range survives Archive redirects and upstream never receives client credentials',async()=>{
 const calls=[];await using(async(url,options)=>{calls.push({url,options});if(calls.length===1)return new Response(null,{status:302,headers:{Location:'https://dn123.us.archive.org/0/items/item/movie.mp4'}});return new Response(new Uint8Array([10,20]),{status:206,headers:{'Content-Type':'video/mp4','Content-Length':'2','Content-Range':'bytes 0-1/100','Set-Cookie':'must-not-leak=1'}});},async base=>{
  const response=await fetch(base+'/__blueness_media/video?url='+encodeURIComponent('https://archive.org/cors/item/movie.mp4'),{headers:{Range:'bytes=0-1',Cookie:'private=1',Authorization:'private'}});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 0-1/100');assert.equal(response.headers.get('set-cookie'),null);assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[10,20]);assert.equal(calls.length,2);
  for(const call of calls){assert.equal(call.options.headers.Range,'bytes=0-1');assert.equal(call.options.headers.Cookie,undefined);assert.equal(call.options.headers.Authorization,undefined);assert.equal(call.options.redirect,'manual');}
  assert.ok(calls[0].url.includes('/download/'));
 });
});
test('a server ignoring Range is cancelled instead of relaying a whole movie',async()=>{
 let cancelled=0;await using(async()=>new Response(new ReadableStream({cancel(){cancelled++;}}),{status:200,headers:{'Content-Type':'video/mp4','Content-Length':'60000000'}}),async base=>{const response=await fetch(base+'/video?url='+encodeURIComponent('https://archive.org/download/item/movie.mp4'),{headers:{Range:'bytes=0-1'}});assert.equal(response.status,502);assert.match((await response.json()).error,/non supporta richieste parziali/);assert.equal(cancelled,1);});
});
test('redirects cannot escape the allowlist and multiple ranges are rejected',async()=>{
 let calls=0;await using(async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private.mp4'}});},async base=>{
  const url=base+'/video?url='+encodeURIComponent('https://archive.org/download/item/movie.mp4');const response=await fetch(url,{headers:{Range:'bytes=0-1'}});assert.equal(response.status,502);assert.equal(calls,1);
  const multi=await fetch(url,{headers:{Range:'bytes=0-1,4-5'}});assert.equal(multi.status,400);assert.equal(calls,1);
 });
});
test('more than eight streams are accepted and a stream nobody reads is closed when idle',async()=>{
 const server=createBluenessMediaRelay({idleMs:200,fetchUpstream:async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(65536));}}),{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes 0-999999999/1000000000'}})});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  const responses=await Promise.all(Array.from({length:10},()=>fetch(base+'/video?url='+encodeURIComponent('https://archive.org/download/item/movie.mp4'),{headers:{Range:'bytes=0-'}})));
  assert.deepEqual(responses.map(r=>r.status),Array(10).fill(206));
  // Nobody reads the bodies: like paused Safari media, the relay must free them.
  await new Promise(resolve=>setTimeout(resolve,1500));
  assert.equal((await (await fetch(base+'/status')).json()).active,0);
  for(const r of responses)await r.body.cancel().catch(()=>{});
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
