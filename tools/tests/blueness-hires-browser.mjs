import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const library=await readFile(process.env.MEDIA_LIBRARY_FIXTURE||'/private/tmp/mediabunny.min.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const wiki of [false,true]){
  const page=await browser.newPage({viewport:{width:1280,height:720}});let serial=0,largeRequests=0,metadataRequests=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const makePNG=async (w,h,n=0)=>Buffer.from(await page.evaluate(([w,h,n])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=`rgb(${n},0,255)`;ctx.fillRect(0,0,w,h);ctx.fillStyle='red';ctx.fillRect(0,0,w*.2,h*.2);return c.toDataURL().split(',')[1];},[w,h,n]),'base64');
  const small=await makePNG(120,90),large=await makePNG(1440,1080);
  const variants=await Promise.all(Array.from({length:16},async(_,n)=>({small:await makePNG(120,90,n*5),large:await makePNG(1440,1080,n*5)})));const ids=new Map();const variant=url=>{const id=new URL(url).pathname.split("/")[2];if(!ids.has(id))ids.set(id,ids.size%variants.length);return variants[ids.get(id)];};
  await page.route('https://cdn.jsdelivr.net/npm/mediabunny@1.61.6/**',r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:library}));
  await page.route('https://archive.org/advancedsearch.php?**',r=>{const cb=new URL(r.request().url()).searchParams.get('callback'),data={response:{numFound:10000,docs:Array.from({length:50},()=>({identifier:'still-'+serial++}))}};return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{headers:{'Access-Control-Allow-Origin':'*'},json:data});});
  await page.route('https://archive.org/metadata/**',r=>{metadataRequests++;return r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{files:[{name:'__ia_thumb.jpg',original:'original.png',source:'derivative',size:small.length},{name:'original.png',source:'original',size:large.length}]}});});
  await page.route('https://archive.org/cors/**',r=>{const high=r.request().url().endsWith('original.png');if(high)largeRequests++;return r.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:high?variant(r.request().url()).large:variant(r.request().url()).small});});
  await page.route('https://commons.wikimedia.org/w/api.php?**',r=>{
   const params=new URL(r.request().url()).searchParams;if(params.has('titles')){metadataRequests++;assert.equal(params.get('iiurlwidth'),'1920');return r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{query:{pages:{1:{imageinfo:[{thumburl:'https://upload.wikimedia.org/high.png',width:1440,height:1080}]}}}}});}
   if(wiki)assert.equal(params.get('iiurlwidth'),'120');
   return r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{query:{pages:Object.fromEntries(Array.from({length:50},()=>{const n=serial++;return [n,{pageid:n,title:'File:Scene '+n+'.png',imageinfo:[{mime:'image/png',thumburl:'https://upload.wikimedia.org/thumb-'+n+'.png',descriptionurl:'https://commons.wikimedia.org/wiki/File:Scene_'+n+'.png'}]}];}))}}});
  });
  await page.route('https://upload.wikimedia.org/**',r=>{const high=r.request().url().endsWith('/high.png');if(high)largeRequests++;return r.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:high?large:small});});
  await page.goto(new URL(wiki?'../../blueness-wiki.html':'../../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>blueStillsExportStatus.images>=3);await page.keyboard.press('Space');
  const count=await page.evaluate(()=>blueStillsExportStatus.images);assert.equal(metadataRequests,0);assert.equal(largeRequests,0);
  assert.equal(await page.evaluate(()=>blueStatus.sources),wiki?'commons':'archive');
  const normal=page.waitForEvent('download');await page.keyboard.press('g');assert.equal((await normal).suggestedFilename(),wiki?'blueness-wiki.mp4':'blueness.mp4');await page.waitForFunction(()=>!blueStillsExportStatus.exporting);assert.equal(metadataRequests,0);assert.equal(largeRequests,0);
  const hd=page.waitForEvent('download',{timeout:45000});await page.keyboard.down('a');await page.keyboard.press('g');await page.keyboard.up('a');
  await page.locator('[data-stills-export-feedback]').waitFor({state:'visible'});
  const file=await hd;assert.equal(file.suggestedFilename(),wiki?'blueness-wiki-hq.mp4':'blueness-hq.mp4');const path='/private/tmp/'+file.suggestedFilename();await file.saveAs(path);await page.waitForFunction(()=>!blueStillsExportStatus.exporting);
  assert.equal(metadataRequests,count);assert.equal(largeRequests,count);
  const probe=JSON.parse(execFileSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_streams','-of','json',path],{encoding:'utf8'})).streams[0];assert.equal(probe.width,1080);assert.equal(probe.height,1440);assert.equal(Number(probe.nb_frames),count);
  assert.match(await page.locator('[data-stills-export-status]').textContent(),new RegExp(count+' immagini HD · 0 miniature'));
  if(!wiki){
   await page.route('https://archive.org/metadata/ambiguous',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{files:[{name:'first.png',source:'original',size:large.length},{name:'second.png',source:'original',size:large.length}]}}));
   const before=largeRequests;
   const fallback=await page.evaluate(async bytes=>{const item={blob:new Blob([new Uint8Array(bytes)],{type:'image/png'}),source:{provider:'archive',id:'ambiguous'}};const result=await resolveStillsHighRes(item);const answer={highRes:result.highRes,width:result.image.width};result.image.close();return answer;},[...small]);
   assert.equal(fallback.highRes,false);assert.equal(fallback.width,120);assert.equal(largeRequests,before,'ambiguous originals must not substitute another photo');
  }
  assert.deepEqual(errors,[]);console.log((wiki?'wiki':'archive')+': tiny live previews, G without high-res requests, A+G same-image HD MP4 and visible feedback');await page.close();
 }
}finally{await browser.close();}
