import test from 'node:test';
import assert from 'node:assert/strict';
import {ClipQueue,decideCut} from './clip-queue.js';
test('a ready related video has priority even at the end of a short clip',()=>{
 assert.equal(decideCut({related:true,elapsed:6,duration:6,remaining:0,ended:true}),'related');
 assert.equal(decideCut({related:false,elapsed:6,duration:6,remaining:0,ended:true}),'queue');
 assert.equal(decideCut({related:false,elapsed:120,duration:300,remaining:180,ended:false}),'queue');
 assert.equal(decideCut({related:false,elapsed:5,duration:30,remaining:25,ended:false}),null);
});
test('queue caps parallel downloads, starts with first ready clip and rejects seen clips',async()=>{
 let id=0,active=0,peak=0; const completions=[]; const seen=new Set(); const discarded=[];
 const queue=new ClipQueue({target:10,concurrency:2,allowed:c=>!seen.has(c.item.id),discard:c=>discarded.push(c.item.id),load:()=>{
 active++;peak=Math.max(peak,active);const n=String(++id);
 return new Promise(resolve=>completions.push(()=>{active--;resolve({item:{id:n}});}));
 }});
 queue.refill(); await Promise.resolve();
 assert.equal(peak,2);
 completions.shift()(); await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(queue.items.length,1); // No waiting for all ten.
 seen.add('1'); assert.equal(queue.take(),null);assert.deepEqual(discarded,['1']);
 queue.stop();completions.forEach(done=>done());
});
test('finite startup queue drains once and never produces ongoing fallback clips',async()=>{
 let calls=0;const discarded=[];
 const queue=new ClipQueue({target:2,concurrency:1,allowed:()=>true,discard:c=>discarded.push(c.item.id),load:async()=>++calls===1?{item:{id:'startup'}}:null});
 queue.refill();await new Promise(resolve=>setTimeout(resolve,300));
 assert.equal(queue.exhausted,true);
 assert.equal(queue.take().item.id,'startup');
 assert.equal(queue.take(),null);
 queue.refill();await new Promise(resolve=>setTimeout(resolve,300));
 assert.equal(calls,2);
 queue.stop();assert.deepEqual(discarded,[]);
});

test('wait for one minute before a ready related cut, unless the video finishes',()=>{
 assert.equal(decideCut({related:true,elapsed:59,duration:180,remaining:100,ended:false}),null);
 assert.equal(decideCut({related:true,elapsed:60,duration:180,remaining:99,ended:false}),'related');
 assert.equal(decideCut({related:true,elapsed:10,duration:20,remaining:.1,ended:false}),'related');
});
