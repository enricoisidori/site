import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const library=await readFile(process.env.MEDIA_LIBRARY_FIXTURE||'/private/tmp/mediabunny.min.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];let libraryRequests=0,serial=0,cachedRequests=0,searches=0,metadataRequests=0;
 await page.addInitScript(()=>{localStorage.setItem('blue-controls-v3-stills',JSON.stringify({quality:1280}));localStorage.setItem('blue-candidates-v1',JSON.stringify([{candidatePolicy:'general-or-color-tag-v1',provider:'archive',kind:'image',verified:true,source:'https://archive.org/details/preselected',url:'https://preselected.test/image.jpg'}]));});
 await page.route('https://archive.org/metadata/**',r=>{metadataRequests++;return r.abort();});
 await page.route('https://preselected.test/**',r=>{cachedRequests++;return r.abort();});
 page.on('pageerror',error=>errors.push(error.message));
 const pngs=await page.evaluate(()=>Array.from({length:80},(_,i)=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');ctx.fillStyle=`rgb(${i},0,255)`;ctx.fillRect(0,0,320,240);return c.toDataURL('image/png').split(',')[1];}));let imageNumber=0;
 await page.route('https://cdn.jsdelivr.net/npm/mediabunny@1.61.6/**',r=>{libraryRequests++;return r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:library});});
 await page.route('https://archive.org/cors/**',r=>r.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from(pngs[imageNumber++%pngs.length],'base64')}));
 await page.route('https://archive.org/advancedsearch.php?**',r=>{const params=new URL(r.request().url()).searchParams;if(++searches===1)assert.ok(!params.get('q').includes('subject:blue'),'live image search must begin with a general search');for(const term of ['trump','maga','campaign','political','republican','subject:"US"'])assert.ok(params.get('q').includes(term),'upstream exclusions must include '+term);const cb=params.get('callback'),data={response:{numFound:10000,docs:Array.from({length:50},()=>({identifier:'still-'+serial++}))}};return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{headers:{'Access-Control-Allow-Origin':'*'},json:data});});
 await page.goto(new URL('../../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.blueStillsExportStatus?.images>=6);await page.keyboard.press('Space');
 const count=await page.evaluate(()=>blueStillsExportStatus.images);assert.equal(libraryRequests,0,'encoding library must be dormant while viewing');
 await page.keyboard.press('c');await page.locator('summary').filter({hasText:'esportazione MP4'}).click();
 assert.equal(cachedRequests,0,'old preselected candidates must be ignored');assert.equal(metadataRequests,0,'stills must avoid metadata even at high quality');
 for(const seconds of [.1,1/60,.2]){
  if(seconds===1/60)await page.locator('[data-stills-duration]').press('Home');
  if(seconds===.2)for(let n=0;n<11;n++)await page.locator('[data-stills-duration]').press('ArrowRight');
  assert.equal(await page.evaluate(()=>blueStillsExportStatus.seconds),seconds);
  const downloaded=page.waitForEvent('download',{timeout:45000});await page.keyboard.press('g');const file=await downloaded;
  assert.equal(file.suggestedFilename(),'blueness.mp4');const path='/private/tmp/blueness-stills-'+seconds+'.mp4';await file.saveAs(path);
  await page.waitForFunction(()=>!blueStillsExportStatus.exporting);
  const probe=JSON.parse(execFileSync(process.env.FFPROBE||'/opt/homebrew/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'}));
  const video=probe.streams.find(s=>s.codec_type==='video');assert.equal(video.width,1080);assert.equal(video.height,1440);assert.equal(Number(video.nb_frames),count);assert.equal(probe.streams.length,1,'still montage must be silent');
  assert.ok(Math.abs(Number(probe.format.duration)-count*seconds)<.002,'all images must last the selected duration');
  assert.equal(await page.evaluate(()=>blueStatus.paused),true,'export must preserve the previous pause state');
 }
 assert.equal(libraryRequests,1);assert.equal(await page.evaluate(()=>blueStillsExportStatus.images),count);assert.deepEqual(errors,[]);
 console.log('PASS: all viewed stills, 1080×1440 MP4, verified startup and live candidates, exact .1/.2 and 1/60 second durations, lazy encoder, no audio, repeated export preserves session');
}finally{await browser.close();}
