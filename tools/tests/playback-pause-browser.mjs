import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=await readFile(process.env.RECORDING_FIXTURE||new URL('../../afterimage/tests/fixture.mp4',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const project of ['bluenessmovements','afterimage-local']){
  const page=await browser.newPage();let serial=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.Worker=class{postMessage(d){setTimeout(()=>this.onmessage?.({data:d.type==='warmup'?{id:d.id,ready:true}:{id:d.id,caption:'a rowing boat on water',inferenceMs:25}}),d.type==='warmup'?40:500)}terminate(){}};});
  await page.route('https://commons.wikimedia.org/w/api.php?**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{query:{pages:Object.fromEntries(Array.from({length:20},()=>{const id=++serial;return [id,{pageid:id,title:'File:boat '+id,videoinfo:[{descriptionurl:'https://commons.wikimedia.org/wiki/File:boat'+id,derivatives:[{src:'https://media.test/'+id+'.mp4',type:'video/mp4',width:320,height:180}],extmetadata:{}}]}]}))}}}));
  await page.route('https://archive.org/advancedsearch.php?**',r=>{const cb=new URL(r.request().url()).searchParams.get('callback'),data={response:{numFound:120000,docs:Array.from({length:50},()=>({identifier:'boat-'+serial++,title:'a rowing boat on water'}))}};return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{json:data});});
  await page.route('https://archive.org/metadata/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{metadata:{title:'a rowing boat on water',collection:['opensource_movies']},files:[{name:'boat.mp4',size:317357,length:32,height:240}]}}));
  await page.route(/https:\/\/(media\.test\/.*|archive\.org\/cors\/.*\.mp4)/,r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'video/mp4',body:fixture}));
  await page.goto(new URL('../../'+project+'/index.html',import.meta.url).href);
  const status=project==='bluenessmovements'?'blueStatus':'afterimageStatus';
  await page.waitForFunction(n=>{const s=window[n];return n==='blueStatus'?s?.shown>0:s?.activeID&&!s.switching;},status,{timeout:30000});
  await page.keyboard.press('Space');await page.waitForFunction(n=>window[n].paused,status);
  const before=await page.evaluate(n=>{const s=window[n];return n==='blueStatus'?s.shown:s.switches;},status);
  await page.waitForFunction(n=>{const s=window[n];return n==='blueStatus'?s.ready.video===6:s.queueGeneral+s.queueSemantic===12;},status,{timeout:30000});
  assert.equal(await page.evaluate(n=>{const s=window[n];return n==='blueStatus'?s.shown:s.switches;},status),before);
  assert.equal(await page.locator(project==='bluenessmovements'?'#stage':'video.on').evaluate(el=>el.tagName==='VIDEO'?el.paused:true),true);
  await page.keyboard.press('Space');await page.waitForFunction(n=>!window[n].paused,status);
  await page.waitForTimeout(150);assert.deepEqual(errors,[]);console.log(project+': pause holds scene, fills ready queue, resumes');await page.close();
 }
}finally{await browser.close();}
