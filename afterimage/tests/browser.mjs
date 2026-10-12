const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1280,height:800}});
const errors=[], requests=[]; let popups=0, serial=0;
page.on('pageerror',e=>errors.push(e.message)); page.on('popup',()=>popups++);
page.on('request',r=>requests.push({url:r.url(),type:r.resourceType()}));
await page.addInitScript(()=>{const original=performance.now.bind(performance);window.__clock=0;performance.now=()=>original()+window.__clock;});
await page.route('**/vision-worker.js',route=>route.fulfill({contentType:'text/javascript',body:`self.onmessage=({data})=>self.postMessage(data.type==='warmup'?{id:data.id,ready:true}:{id:data.id,caption:'a rowing boat on water',inferenceMs:25});`}));
await page.route('https://archive.org/advancedsearch.php?**',async route=>{
 await new Promise(r=>setTimeout(r,150));
 const docs=Array.from({length:50},()=>({identifier:'boat-'+serial++,title:'A rowing boat on water'}));
 return route.fulfill({json:{response:{numFound:120000,docs}}});
});
await page.route('https://archive.org/metadata/**',route=>{
 const id=route.request().url().split('/').pop();
 return route.fulfill({json:{metadata:{title:'A rowing boat on water '+id,subject:['rowing','boat','water']},files:[
 {name:'boat.mp4',original:'boat.mpeg',size:317357,length:32,height:240},
 {name:'boat.thumbs/boat_000005.jpg'},
 ]}});
});
const file=await readFile(new URL('./fixture.mp4', import.meta.url));
await page.route('https://archive.org/download/**',route=>route.fulfill({contentType:'video/mp4',body:file}));
// A valid tiny scene exercises the CORS fallback path, not the model's accuracy.
const imagePage=await browser.newPage();
const png=await imagePage.evaluate(()=>{const c=document.createElement('canvas');c.width=16;c.height=16;c.getContext('2d').fillRect(0,0,16,16);return c.toDataURL('image/png').split(',')[1];});await imagePage.close();
await page.route('https://archive.org/cors/**/*.jpg',route=>route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}));
await page.goto(process.env.RELAY_URL || 'http://127.0.0.1:8091/');
assert.equal(await page.locator('#loading span').textContent(),'waiting');
assert.equal(await page.locator('#skipArea').isDisabled(),true);
assert.equal(await page.locator('#info').evaluate(e=>e.hidden),true);
await page.waitForFunction(()=>document.querySelector('video.on')?.currentTime>.2);
await page.waitForFunction(()=>document.querySelector('#loading').classList.contains('revealed'));
await page.keyboard.press('i');
await page.waitForFunction(()=>document.querySelector('#info').innerText.includes('successore della query pronto')||document.querySelector('#info').innerText.includes('della query pronti')&&document.querySelectorAll('video').length===6);
await page.waitForFunction(()=>document.querySelector('#info').innerText.includes('3 della query pronti'));
assert.ok(await page.locator('#info mark').count()>0);
assert.equal(await page.locator('video.on').count(),1);
assert.equal(await page.locator('video.on').evaluate(v=>v.loop),false);
assert.ok(await page.locator('video.on').evaluate(v=>v.currentSrc.startsWith('https://archive.org/download/')));
assert.equal(await page.locator('#info').evaluate(e=>getComputedStyle(e).textTransform),'lowercase');
assert.ok(await page.locator('#info').evaluate(e=>getComputedStyle(e).fontFamily.includes('Helvetica')));
await page.keyboard.press('m');assert.equal(await page.locator('video.on').evaluate(v=>v.muted),false);
await page.keyboard.press('f');assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
await page.keyboard.press('f');assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false);
// Ordinary playback does not cut before 30s. At 31s it uses a prepared query result.
assert.ok(await page.locator('#info').innerText().then(t=>t.includes('0 cambi')));
await page.evaluate(()=>{window.__clock+=31000;document.querySelector('video.on').currentTime+=.1;});
await page.waitForFunction(()=>document.querySelector('#info').innerText.includes('1 cambi'));
assert.ok(await page.locator('#info').innerText().then(t=>t.includes('collegamento nella query')));
await page.waitForFunction(()=>!document.querySelector('#skipArea').disabled);
const before=await page.locator('#sourceLink').getAttribute('href');
const started=Date.now();await page.locator('#skipArea').click();
await page.waitForFunction(previous=>document.querySelector('#sourceLink')?.getAttribute('href')!==previous,before);
assert.ok(Date.now()-started<1500,'il clic deve promuovere un lettore pronto');
assert.equal(popups,0);assert.equal(await page.locator('video.on').count(),1);
assert.ok(await page.locator('#info').innerText().then(t=>t.includes('cambio casuale al clic')));
assert.ok(requests.filter(r=>/\.mp4(?:$|\?)/.test(r.url)).every(r=>r.type==='media'));
assert.ok(!requests.some(r=>/startup\.json|blob:/.test(r.url)));
// Broken model: general reserves remain alive and provide the 60s fallback.
await page.route('**/vision-worker.js',route=>route.fulfill({contentType:'text/javascript',body:'self.onmessage=()=>{};'}));
await page.reload();await page.waitForFunction(()=>document.querySelector('video.on')?.currentTime>.2);
await page.keyboard.press('i');
await page.waitForFunction(()=>document.querySelector('#info').innerText.includes('2 casuali pronti'));
await page.evaluate(()=>{window.__clock+=61000;document.querySelector('video.on').currentTime+=.1;});
await page.waitForFunction(()=>document.querySelector('#info').innerText.includes('1 fallback casuali'));
assert.equal(await page.locator('video.on').count(),1);
assert.equal(await page.locator('video.on').evaluate(v=>v.loop),false);
assert.deepEqual(errors,[]);
// If all reserves fail, the 60s limit shows waiting instead of rewinding.
let allowedStream;
await page.route('https://archive.org/download/**',route=>{
 allowedStream ||= route.request().url();
 return route.request().url()===allowedStream ? route.fulfill({contentType:'video/mp4',body:file}) : route.abort();
});
await page.reload();await page.waitForFunction(()=>document.querySelector('video.on')?.currentTime>.2);
await page.keyboard.press('i');
await page.evaluate(()=>{window.__clock+=61000;document.querySelector('video.on').currentTime+=.1;});
await page.waitForFunction(()=>!document.querySelector('#loading').classList.contains('revealed'));
assert.equal(await page.locator('video.on').evaluate(v=>v.paused),true);
assert.equal(await page.locator('video.on').evaluate(v=>v.loop),false);
assert.equal(await page.locator('#skipArea').isDisabled(),true);
const pausedTime=await page.locator('video.on').evaluate(v=>v.currentTime);
await page.waitForTimeout(150);
assert.equal(await page.locator('video.on').evaluate(v=>v.currentTime),pausedTime);
assert.deepEqual(errors,[]);
await page.screenshot({path:'/tmp/relay-v2-browser.png'});
console.log('PASS: waiting/noise, sei lettori, solo streaming, coda condivisa, keyword, 30–60s, clic pronto senza schede, i/m/f, helvetica minuscola, fallback con modello bloccato e waiting a 60s senza riserve');
await browser.close();
