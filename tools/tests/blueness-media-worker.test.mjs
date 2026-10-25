import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../blueness-media-worker.mjs';
const site='https://enricoisidori.com/__blueness_media';
async function withFetch(fake,run){const original=globalThis.fetch;globalThis.fetch=fake;try{await run();}finally{globalThis.fetch=original;}}
test('worker status answers the same contract the iOS client probes',async()=>withFetch(()=>{throw Error('unexpected fetch');},async()=>{
 const response=await worker.fetch(new Request(site+'/status'));assert.equal(response.status,200);assert.equal((await response.json()).service,'blueness-range-relay');
}));
test('worker streams a 206 Range response from Commons without forwarding cookies',async()=>{
 const calls=[];await withFetch(async(url,init)=>{calls.push({url,init});return new Response(new Uint8Array([1,2,3]),{status:206,headers:{'Content-Type':'video/webm','Content-Length':'3','Content-Range':'bytes 0-2/900','Set-Cookie':'x=1','Access-Control-Allow-Origin':'*'}});},async()=>{
  const remote='https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e7/A.webm/A.webm.240p.vp9.webm';
  const response=await worker.fetch(new Request(site+'/video?url='+encodeURIComponent(remote),{headers:{Range:'bytes=0-2',Cookie:'session=private'}}));
  assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 0-2/900');assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
  assert.equal(calls.length,1);assert.equal(calls[0].url,remote);assert.deepEqual(calls[0].init.headers,{'Accept-Encoding':'identity','User-Agent':'BluenessMediaRelay/1.0 (https://enricoisidori.com/blueness/)',Range:'bytes=0-2'});
 });
});
test('worker refuses hosts outside the public video allowlist',async()=>withFetch(()=>{throw Error('unexpected fetch');},async()=>{
 const response=await worker.fetch(new Request(site+'/video?url='+encodeURIComponent('https://example.com/movie.mp4')));assert.equal(response.status,400);
}));
test('client disconnect aborts the upstream request',async()=>{
 const client=new AbortController();let upstreamSignal;
 await withFetch(async(url,init)=>{upstreamSignal=init.signal;client.abort();if(init.signal.aborted)throw init.signal.reason;throw Error("signal not linked");},async()=>{
  const response=await worker.fetch(new Request(site+'/video?url='+encodeURIComponent('https://archive.org/download/item/movie.mp4'),{signal:client.signal}));
  assert.equal(response.status,502);assert.equal(upstreamSignal.aborted,true);
 });
});
