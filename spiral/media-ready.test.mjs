import test from 'node:test';
import assert from 'node:assert/strict';
import {bufferedAhead,readyForCut,contentKey} from './media-ready.js';
const video=(ranges,currentTime=10,duration=100,readyState=4)=>({currentTime,duration,readyState,buffered:{length:ranges.length,start:i=>ranges[i][0],end:i=>ranges[i][1]}});
test('require a decoded frame and contiguous footage after the seek position',()=>{
 assert.equal(readyForCut(video([[0,30]])),true);
 assert.equal(readyForCut(video([[0,5],[20,50]])),false);
 assert.equal(readyForCut(video([[0,10.5]])),false);
 assert.equal(readyForCut(video([[0,30]],10,100,2)),false);
 assert.equal(readyForCut(video([[0,12.2]])),true); // WebKit may cap a paused preload at about two seconds.
 assert.equal(bufferedAhead(video([[0,5],[10,30]])),20);
});
test('short videos are ready when their remaining footage is buffered',()=>{
 assert.equal(readyForCut(video([[0,14]],10,14)),true);
 assert.equal(readyForCut(video([[0,14]],14,14)),false);
});
test('Archive metadata hashes prevent duplicates without waiting for fetch body completion',()=>{
 assert.equal(contentKey('md5:abc'),'md5:abc');
 assert.equal(contentKey('abc'),'sha256:abc');
 assert.equal(contentKey(null),null);
});
