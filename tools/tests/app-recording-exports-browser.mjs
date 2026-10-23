import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const library=await readFile('/private/tmp/mediabunny.min.mjs');
const fixture=await readFile(process.env.RECORDING_FIXTURE||new URL('../../afterimage/tests/fixture.mp4',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const project of (process.env.RECORDING_PROJECT?[process.env.RECORDING_PROJECT]:['blueness','afterimage-local','afterimage-root'])){
  const page=await browser.newPage();let serial=0,archiveUnavailable=project==='afterimage-root';const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/npm/mediabunny@1.61.6/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:library}));
  await page.route('https://archive.org/services/img/**',r=>r.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')}));
  if(project==='afterimage-root')await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;window.startFailures=0;HTMLMediaElement.prototype.play=function(){if(!window.startFailures){window.startFailures++;return Promise.reject(Error('simulated decoder start failure'));}return play.call(this);};});
  if(project==='blueness')await page.addInitScript(()=>localStorage.setItem('blue-controls-v3-video',JSON.stringify({excludeGovernment:true,excludePolitics:true})));
  await page.addInitScript(()=>{window.Worker=class{postMessage(d){setTimeout(()=>this.onmessage?.({data:d.type==='warmup'?{id:d.id,ready:true}:{id:d.id,caption:'a rowing boat on water',inferenceMs:25}}),d.type==='warmup'?40:500)}terminate(){}};});
  await page.route('https://commons.wikimedia.org/w/api.php?**',r=>{if(project==='blueness'){const query=new URL(r.request().url()).searchParams;if(query.has('generator')){assert.equal(query.get('gsrsearch'),'filetype:video ');assert.equal(query.get('prop'),'videoinfo');assert.equal(query.has('cllimit'),false);}}return r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{query:{pages:Object.fromEntries(Array.from({length:20},()=>{const id=++serial;return [id,{pageid:id,title:'File:Trump government politics NASA boat '+id,videoinfo:[{descriptionurl:'https://commons.wikimedia.org/wiki/File:boat'+id,derivatives:[{src:'https://media.test/'+id+'.mp4',type:'video/mp4',width:320,height:180}],extmetadata:{}}]}]}))}}});});
  await page.route('https://archive.org/services/search/v1/scrape?**',r=>r.fulfill({status:archiveUnavailable?503:200,json:{total:0,items:[]}}));
  await page.route('https://archive.org/advancedsearch.php?**',r=>{if(archiveUnavailable)return r.fulfill({status:503,body:'temporary outage'});const cb=new URL(r.request().url()).searchParams.get('callback'),data={response:{numFound:120000,docs:Array.from({length:50},()=>({identifier:'boat-'+serial++,title:'a rowing boat on water'}))}};return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{json:data});});
  await page.route('https://archive.org/metadata/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{metadata:{title:'a rowing boat on water',collection:['opensource_movies']},files:[{name:'boat.mp4',size:317357,length:32,height:240}]}}));
  await page.route(/https:\/\/(media\.test\/.*|upload\.wikimedia\.org\/.*|archive\.org\/cors\/.*\.mp4)/,r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'video/mp4',body:fixture}));
  if(project==='afterimage-root'){
   await page.route('http://127.0.0.1:9997/**',async route=>{const pathname=new URL(route.request().url()).pathname;try{const body=await readFile(new URL('../../afterimage'+(pathname==='/'?'/index.html':pathname),import.meta.url));await route.fulfill({body,contentType:pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:'missing module'});}});
   await page.goto('http://127.0.0.1:9997/',{waitUntil:'domcontentloaded'});
  }else await page.goto(new URL('../../'+project+'/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
  const status=project==='blueness'?'blueStatus':'afterimageStatus';
  if(project==='afterimage-root'){await page.waitForFunction(()=>window.afterimageStatus?.message.includes('non risponde')&&!document.querySelector('#info').hidden);archiveUnavailable=false;}
  try{await page.waitForFunction(n=>{const s=window[n];return n==='blueStatus'?s?.shown>0:s?.activeID&&!s.switching;},status,{timeout:30000});}catch(error){console.log('startup failure',await page.evaluate(()=>{const s=window.afterimageStatus||window.blueStatus;return {step:s?.step,message:s?.message,loading:s?.loading,active:s?.activeID,switching:s?.switching,errors:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,state:v.readyState,error:v.error?.message}))};}),errors);throw error;}
  if(project==='blueness')assert.equal(await page.evaluate(()=>Object.hasOwn(window.blueStatus.settings,'excludePolitics')||Object.hasOwn(window.blueStatus.settings,'excludeGovernment')),false);
  if(project==='afterimage-root')assert.equal(await page.evaluate(()=>window.startFailures),1);
  assert.equal(await page.evaluate(n=>n==='blueStatus'?window[n].queueLimit:window[n].queueTarget,status),project==='blueness'?6:5);
  await page.keyboard.press('Space');await page.waitForFunction(n=>window[n].paused,status);assert.equal(await page.evaluate(n=>n==='blueStatus'?window[n].queueLimit:window[n].queueTarget,status),project==='blueness'?6:12);
  const before=await page.evaluate(n=>{const s=window[n];return n==='blueStatus'?s.shown:s.switches;},status);
  await page.waitForFunction(n=>{const s=window[n];return n==='blueStatus'?s.ready.video===6:s.queueGeneral+s.queueSemantic===12;},status,{timeout:30000});
  assert.equal(await page.evaluate(n=>{const s=window[n];return n==='blueStatus'?s.shown:s.switches;},status),before);
  assert.equal(await page.locator(project==='blueness'?'#stage':'video.on').evaluate(el=>el.tagName==='VIDEO'?el.paused:true),true);
  await page.keyboard.press('Space');await page.waitForFunction(n=>!window[n].paused,status);assert.equal(await page.evaluate(n=>n==='blueStatus'?window[n].queueLimit:window[n].queueTarget,status),project==='blueness'?6:5);
  await page.waitForTimeout(150);assert.deepEqual(errors,[]);
  if(project!=='blueness'&&await page.locator('#info').isVisible())await page.keyboard.press('c');
  await page.keyboard.press('c');await page.locator('[data-recording] summary').click();assert.equal(await page.locator('[data-recording-trace]').count(),0);await page.keyboard.press('r');await page.waitForFunction(n=>window[n].recording.phase==='recording',status);await page.waitForTimeout(100);await page.keyboard.press('s');await page.waitForTimeout(250);
  await page.keyboard.press('e');assert.equal(await page.evaluate(n=>window[n].recording.phase,status),'recording');
  const recorded=page.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('.mp4'),timeout:45000});await page.keyboard.press('r');await recorded;await page.waitForFunction(n=>window[n].recording.phase==='idle',status);
  const screens=page.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('-screens.mp4'),timeout:45000});await page.keyboard.press('g');await screens;await page.waitForFunction(n=>window[n].recording.phase==='idle',status);assert.deepEqual(errors,[]);
  const pdf=page.waitForEvent('download',{predicate:d=>d.suggestedFilename().endsWith('.pdf'),timeout:45000});await page.keyboard.press('p');await pdf;
  console.log(project+': pause, ready queue, R selective MP4, G screen MP4, P PDF');await page.close();
 }
}finally{await browser.close();}
