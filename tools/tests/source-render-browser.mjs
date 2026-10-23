import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const read=async file=>(await readFile(new URL('../../assets/shared/recording/'+file,import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const code=await read('mp4-muxer.js')+'\n'+await read('render.js')+'\n'+await read('recorder.js');
const fixture=await readFile(process.env.RECORDING_FIXTURE||new URL('../../afterimage/tests/fixture.mp4',import.meta.url));
const library=await readFile('/private/tmp/mediabunny.min.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
 let libraryRequests=0;
 await page.route('https://cdn.jsdelivr.net/npm/mediabunny@1.61.6/**',async r=>{libraryRequests++;await new Promise(resolve=>setTimeout(resolve,250));return r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:library});});
 await page.route('http://127.0.0.1:9999/**',r=>r.request().url().endsWith('.mp4')?r.fulfill({contentType:'video/mp4',body:fixture}):r.fulfill({contentType:'text/html',body:'<!doctype html><video id="v" muted autoplay loop playsinline src="clip.mp4"></video>'}));
 await page.goto('http://127.0.0.1:9999/');
 await page.evaluate(code+`\nconst v=document.querySelector('video');window.getLayout=()=>({layers:[{source:{x:0,y:0,width:1,height:1},destination:{x:370+(window.pan||0),y:0,width:540,height:720}}]});window.rec=createSelectiveRecorder({name:'source-test',getScene:()=>({key:1,video:v,muted:true,layout:getLayout(),draw:()=>{}}),getSnapshots:async()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;c.getContext('2d').fillRect(0,0,1280,720);return [{blob:await new Promise(r=>c.toBlob(r)),layout:getLayout()},{source:{url:v.src},time:.1,layout:getLayout()}];}});document.body.insertAdjacentHTML('beforeend',rec.controlsHTML());`);
 await page.waitForFunction(()=>document.querySelector('video').readyState>=3);
 assert.equal(libraryRequests,0,'no export engine should load while viewing');
 assert.equal(await page.locator('[data-recording-trace]').count(),0);
 assert.equal(await page.locator('[data-recording-action=instructions]').count(),0);
 await page.keyboard.press('e');assert.equal(await page.evaluate(()=>rec.status.phase),'idle');assert.equal(libraryRequests,0);
 const gif=page.waitForEvent('download');await page.keyboard.press('g');const reel=await gif;assert.equal(reel.suggestedFilename(),'source-test-screens.mp4');await reel.saveAs('/private/tmp/screen-test.mp4');await page.waitForFunction(()=>rec.status.phase==='idle');
 assert.equal(libraryRequests,1);assert.equal(await page.locator('[data-mp4-status]').getAttribute('data-stage'),'complete');assert.deepEqual(errors,[]);console.log('PASS: no E, no instructions, lazy G screen MP4, completed status');
}finally{await browser.close();}
