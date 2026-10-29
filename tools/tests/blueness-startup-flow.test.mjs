import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../blue-flow.js',import.meta.url),'utf8');
const sequence=source.slice(source.indexOf('async function startIntroSequence(){'),source.indexOf('\nfunction pump(){'));
test('slow live never leaves a preloaded photo frozen; actual live stops the intro',async()=>{
 const timers=[],painted=[];let decoded=0;
 const context=vm.createContext({mode:'image',baseStills:true,introEnabled:true,sources:'archive',BLUENESS_STARTUP:{frames:Array.from({length:4},(_,id)=>({id})),image:'fixture'},current:null,playbackPaused:false,document:{hidden:false,getElementById:()=>({})},introSequence:[],introFrame:null,introEnded:false,previewShown:0,canvas:{width:390,height:844},ctx:{fillStyle:'',fillRect(){}},settings:{size:50},screens:()=>[],introEndsAt:5000,performance:{now:()=>painted.length*50},Image:class{async decode(){decoded++;}},paintIntroFrame:(_,item)=>painted.push(item.id),setTimeout:(callback,delay)=>{assert.equal(delay,50);timers.push(callback);}});
 vm.runInContext(sequence,context);await vm.runInContext('startIntroSequence()',context);
 while(timers.length)timers.shift()();
 assert.equal(context.previewShown,100,'animation stops at five seconds');
 assert.equal(context.introEnded,true,'the last preload is cleared rather than held as a fake live image');
 assert.equal(decoded,1,'same local sheet decoded only once');
 assert.equal(context.current,null,'intro never pretends to be live');
 context.current={source:'fresh-live-result'};
 assert.equal(timers.length,0,'intro stays stopped after the five-second cap');
 assert.equal(context.previewShown,100);
});
test('initial network pump precedes local intro decode',()=>{
 assert.ok(source.includes('seedCandidates();renderInfo();pump();startIntroSequence();'));
});
