import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const library=await readFile(process.env.MEDIA_LIBRARY_FIXTURE||'/private/tmp/mediabunny.min.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];let libraryRequests=0,serial=0;
 page.on('pageerror',error=>errors.push(error.message));
 const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');ctx.fillStyle='blue';ctx.fillRect(0,0,320,240);return c.toDataURL('image/png').split(',')[1];}),'base64');
 await page.route('https://cdn.jsdelivr.net/npm/mediabunny@1.61.6/**',r=>{libraryRequests++;return r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:library});});
 await page.route('https://archive.org/cors/**',r=>r.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:png}));
 await page.route('https://archive.org/advancedsearch.php?**',r=>{const cb=new URL(r.request().url()).searchParams.get('callback'),data={response:{numFound:10000,docs:Array.from({length:50},()=>({identifier:'still-'+serial++}))}};return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{headers:{'Access-Control-Allow-Origin':'*'},json:data});});
 await page.goto(new URL('../../blueness-stills/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.blueStillsExportStatus?.images>=6);await page.keyboard.press('Space');
 const count=await page.evaluate(()=>blueStillsExportStatus.images);assert.equal(libraryRequests,0,'encoding library must be dormant while viewing');
 await page.keyboard.press('c');await page.locator('summary').filter({hasText:'esportazione MP4'}).click();
 for(const seconds of [.3,.1]){
  if(seconds===.1)await page.locator('[data-stills-duration]').press('Home');
  assert.equal(await page.evaluate(()=>blueStillsExportStatus.seconds),seconds);
  const downloaded=page.waitForEvent('download',{timeout:45000});await page.keyboard.press('g');const file=await downloaded;
  assert.equal(file.suggestedFilename(),'blueness-stills.mp4');const path='/private/tmp/blueness-stills-'+seconds+'.mp4';await file.saveAs(path);
  await page.waitForFunction(()=>!blueStillsExportStatus.exporting);
  const probe=JSON.parse(execFileSync(process.env.FFPROBE||'/opt/homebrew/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'}));
  const video=probe.streams.find(s=>s.codec_type==='video');assert.equal(video.width,1080);assert.equal(video.height,1440);assert.equal(Number(video.nb_frames),count);assert.equal(probe.streams.length,1,'still montage must be silent');
  assert.ok(Math.abs(Number(probe.format.duration)-count*seconds)<.04,'all images must last the selected duration');
  assert.equal(await page.evaluate(()=>blueStatus.paused),true,'export must preserve the previous pause state');
 }
 assert.equal(libraryRequests,1);assert.equal(await page.evaluate(()=>blueStillsExportStatus.images),count);assert.deepEqual(errors,[]);
 console.log('PASS: all viewed stills, 1080×1440 MP4, exact .3/.1 second durations, lazy encoder, no audio, repeated export preserves session');
}finally{await browser.close();}
