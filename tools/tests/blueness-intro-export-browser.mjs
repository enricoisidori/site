import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const library=await readFile('/private/tmp/mediabunny.min.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let serial=0,metadata=0,encoder=0;
 const reference=await readFile(new URL('../../blueness/preload/wkd-old-cap-blue.jpg',import.meta.url));
 const hd=await page.evaluate(async data=>{const image=new Image();image.src='data:image/jpeg;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width*3;c.height=image.height*3;c.getContext('2d').drawImage(image,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.95).split(',')[1];},reference.toString('base64'));
 const fixtures=await page.evaluate(()=>Array.from({length:160},(_,i)=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');x.fillStyle=`rgb(${i%80},0,255)`;x.fillRect(0,0,320,240);return c.toDataURL().split(',')[1];}));
 await page.route('https://cdn.jsdelivr.net/npm/mediabunny@1.61.6/**',r=>{encoder++;return r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:library});});
 await page.route('https://archive.org/metadata/**',r=>{metadata++;return r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{files:r.request().url().endsWith('/wkd-old-cap-blue')?[{name:'__ia_thumb.jpg',original:'fixture-hd.jpg'},{name:'fixture-hd.jpg',source:'original',size:Buffer.from(hd,'base64').length}]:[]}});});
 await page.route('https://archive.org/cors/**',r=>{if(r.request().url().endsWith('/fixture-hd.jpg'))return r.fulfill({contentType:'image/jpeg',headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from(hd,'base64')});const id=Number(r.request().url().match(/export-v-(\d+)/)?.[1]||0);return r.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from(fixtures[id%160],'base64')});});
 await page.route('https://archive.org/advancedsearch.php?**',r=>{const cb=new URL(r.request().url()).searchParams.get('callback'),data={response:{numFound:10000,docs:Array.from({length:50},()=>({identifier:'export-v-'+serial++}))}};return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{headers:{'Access-Control-Allow-Origin':'*'},json:data});});
 await page.goto(new URL('../../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>blueStillsExportStatus.images>=4);await page.keyboard.press('Space');
 const count=await page.evaluate(()=>blueStillsExportStatus.images);assert.equal(metadata,0);assert.equal(encoder,0);
 const pool=await page.evaluate(()=>BLUENESS_STARTUP.frames.length);
 const run=async(keys,filename,expectedFrames,hd)=>{
  const before=metadata,download=page.waitForEvent('download',{timeout:90000});
  for(const key of keys)await page.keyboard.down(key);for(const key of [...keys].reverse())await page.keyboard.up(key);
  const file=await download;assert.equal(file.suggestedFilename(),filename);const path='/private/tmp/'+filename;await file.saveAs(path);
  await page.waitForFunction(()=>!blueStillsExportStatus.exporting);
  const probe=JSON.parse(execFileSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'})),video=probe.streams[0];
  assert.equal(video.width,1080);assert.equal(video.height,1440);assert.equal(probe.streams.length,1);assert.equal(Number(video.nb_frames),expectedFrames);
  assert.equal(await page.evaluate(()=>blueStatus.paused),true);assert.equal(await page.evaluate(()=>blueStillsExportStatus.images),count);
  if(hd)assert.ok(metadata>before);else assert.equal(metadata,before);
  return Number(probe.format.duration);
 };
 const normal=await run(['v'],'blueness-intro.mp4',count+12,false);assert.ok(normal>4.5+count*.1);
 const extended=await run(['v','l'],'blueness-intro-long.mp4',pool,false);assert.ok(Math.abs(extended-pool*.1)<.003);
 await run(['v','a'],'blueness-intro-hq.mp4',count+12,true);
 await run(['a','l','v'],'blueness-intro-long-hq.mp4',pool,true);
 assert.match(await page.locator('[data-stills-export-status]').textContent(),/[1-9]\d* immagini HD/,'an equivalent HD source must actually replace an intro thumbnail');
 assert.equal(encoder,1,'all exports must reuse the lazily loaded encoder');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,vFrames:count+12,longFrames:pool,vSeconds:normal,longSeconds:extended,chordsAnyOrder:true,hdOnlyOnRequest:true}));
}finally{await browser.close();}
