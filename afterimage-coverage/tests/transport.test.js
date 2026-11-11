import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveJSON} from '../archive-transport.js';
function environment(t,{protocol='https:',fetcher,jsonp}={}){
 const previous=Object.fromEntries(['location','document','window','fetch'].map(k=>[k,globalThis[k]]));
 globalThis.location={protocol};globalThis.window={};
 globalThis.document={createElement:()=>({remove(){}}),head:{append(script){queueMicrotask(()=>jsonp?.(new URL(script.src)));}}};globalThis.fetch=fetcher;
 t.after(()=>{for(const [k,v]of Object.entries(previous))v===undefined?delete globalThis[k]:globalThis[k]=v;});
}
const url='https://archive.org/advancedsearch.php?q=mediatype%3Amovies&rows=50&sort%5B%5D=identifier+desc';
const result={response:{numFound:123,docs:[{identifier:'movie'}]}};
test('healthy Archive search makes only one request',async t=>{
 let fetches=0,scripts=0;environment(t,{fetcher:async()=>{fetches++;return {ok:true,json:async()=>result};},jsonp:()=>scripts++});
 assert.deepEqual(await archiveJSON(url),result);await new Promise(r=>setImmediate(r));assert.equal(fetches,1);assert.equal(scripts,0);
});
test('a stalled fetch recovers through JSONP and cancels the loser',async t=>{
 let aborted=false,scrapes=0;environment(t,{fetcher:(u,{signal})=>{if(u.includes('/scrape'))scrapes++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);}));},jsonp:u=>window[u.searchParams.get('callback')](result)});
 const start=Date.now();assert.deepEqual(await archiveJSON(url),result);assert.ok(Date.now()-start<2500);assert.equal(aborted,true);assert.equal(scrapes,0);
});
test('file HTML uses JSONP without a failing cross-origin fetch',async t=>{
 let fetches=0;environment(t,{protocol:'file:',fetcher:async()=>{fetches++;throw Error('unexpected');},jsonp:u=>window[u.searchParams.get('callback')](result)});
 assert.deepEqual(await archiveJSON(url),result);assert.equal(fetches,0);
});
test('scrape fallback retains the exact query and sort',async t=>{
 const seen=[];environment(t,{fetcher:async u=>{seen.push(String(u));if(String(u).includes('/scrape'))return {ok:true,json:async()=>({total:20,items:[{identifier:'recovery'}]})};throw Error('CORS');},jsonp:u=>window[u.searchParams.get('callback')]({error:'backend failed'})});
 const r=await archiveJSON(url);assert.equal(r.response.numFound,20);assert.equal(r.recovery,true);const q=new URL(seen.at(-1));assert.equal(q.searchParams.get('q'),'mediatype:movies');assert.equal(q.searchParams.get('sorts'),'identifier desc');
});
test('caller cancellation is propagated without waiting for network timeouts',async t=>{
 environment(t,{fetcher:(u,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason)))});
 const c=new AbortController(),reason=new Error('cancelled');const p=archiveJSON(url,c.signal);c.abort(reason);await assert.rejects(p,e=>e===reason);
});
