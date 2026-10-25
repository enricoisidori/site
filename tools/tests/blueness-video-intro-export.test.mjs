import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const recorder=await readFile(new URL('../../assets/shared/recording/recorder.js',import.meta.url),'utf8');
test('V prefixes intro to the same screen snapshots as G; normal export does not prepare intro',async()=>{
 const calls=[],saved=[],snapshots=[{blob:'first'},{blob:'second'}],context=vm.createContext({phase:'idle',exportPromise:null,renderAbort:null,exportTimer:null,AbortController,dimensions:{width:1080,height:1440},frameRectangle:()=>({x:0,y:0,width:810,height:1080}),beginExport(){},syncControls(){},suspendPlayback:()=>()=>calls.push('resume'),exportProgress(){},getSnapshots:async()=>snapshots,getScreenIntro:async options=>{calls.push('prepare intro');assert.equal(options.frame.width,810);return {items:[{blob:'intro',seconds:.05,introSVG:true}],render:async items=>{calls.push(items);return 'intro-mp4';}};},renderScreenReel:async items=>{calls.push(items);return 'normal-mp4';},saveRecordingFile:(blob,name)=>saved.push({blob,name}),name:'bluenessmovements',message(){},clearInterval(){},setTimeout(){},hud:{}});
 vm.runInContext(recorder.slice(recorder.indexOf(' async function exportScreens('),recorder.indexOf(" document.addEventListener('keydown'")),context);
 await context.exportScreens();assert.equal(calls.includes('prepare intro'),false);assert.equal(calls[0],snapshots);assert.equal(saved[0].blob,'normal-mp4');
 await context.exportScreens(true);assert.equal(calls.includes('prepare intro'),true);const montage=calls.find(value=>Array.isArray(value)&&value.length===3);assert.deepEqual(Array.from(montage,item=>item.blob),['intro','first','second']);assert.equal(saved[1].blob,'intro-mp4');assert.equal(saved[1].name,'bluenessmovements-intro.mp4');
});
test('V is opt-in for this recorder and has no A/L variants',()=>{
 assert.ok(recorder.includes("key==='v'&&getScreenIntro"));assert.ok(!recorder.includes('aHeld'));assert.ok(!recorder.includes('lHeld'));
});
