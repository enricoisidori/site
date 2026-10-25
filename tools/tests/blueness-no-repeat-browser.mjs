import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 // Exhaust the local reserve to exercise pixel deduplication on live responses.
 const catalog=JSON.parse(await readFile(new URL('../catalogs/blueness-images.json',import.meta.url),'utf8'));
 await page.addInitScript(items=>{for(const item of items){const u=new URL(item.source);localStorage.setItem('blueness-seen-v2:'+decodeURIComponent(u.hostname+u.pathname).replace(/_/g,' ').normalize('NFC'),'1');}},catalog);
 const fixtures=await page.evaluate(()=>Array.from({length:160},(_,i)=>{const c=document.createElement('canvas');c.width=160;c.height=100;const x=c.getContext('2d');x.fillStyle=`rgb(${i%80},${Math.floor(i/80)*30},255)`;x.fillRect(0,0,160,100);return c.toDataURL('image/png').split(',')[1];}));
 let sequence=0;const checks=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://archive.org/advancedsearch.php?**',r=>{const params=new URL(r.request().url()).searchParams;checks.push(params.get('q'));const cb=params.get('callback'),data={response:{numFound:10000,docs:Array.from({length:50},()=>({identifier:'test-'+sequence++}))}};return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{headers:{'Access-Control-Allow-Origin':'*'},json:data});});
 // Distinct URLs deliberately serve the same pixels in pairs.
 await page.route('https://archive.org/cors/**',r=>{const id=Number(new URL(r.request().url()).pathname.match(/test-(\d+)/)?.[1]||0);return r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'image/png',body:Buffer.from(fixtures[Math.floor(id/2)%160],'base64')});});
 await page.goto(new URL('../../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.locator('#blueness-intro').waitFor();await page.waitForFunction(()=>blueStatus.shown>=5);
 assert.equal(await page.locator('#blueness-intro').count(),0,'SVG must disappear after the first two live images');
 await page.keyboard.press('Space');const before=await page.evaluate(()=>({shown:blueStatus.shown,played:Object.keys(localStorage).filter(k=>k.startsWith('blueness-seen-v2:pixels-v1:')).map(k=>k.split('blueness-seen-v2:')[1])}));
 await page.locator('#stage').click({position:{x:20,y:20}});assert.equal(await page.evaluate(()=>blueStatus.shown),before.shown,'click must not skip');
 const fingerprints=await page.evaluate(()=>blueStatus.verifiedImages.map(i=>i.fingerprint));assert.equal(new Set(fingerprints).size,fingerprints.length,'duplicate pixel images must not enter queue');
 assert.ok(checks.every(q=>q.includes('"capitol attack"')&&q.includes('"capitol hill"')&&q.includes('NOT subject:"January 6 Capitol Attack"')));
 await page.reload({waitUntil:'domcontentloaded'});await page.keyboard.press('Space');
 // Resume if the saved pause key happened before the initial image.
 if(await page.evaluate(()=>blueStatus.paused))await page.keyboard.press('Space');
 for(let n=0;n<12;n++){await page.waitForTimeout(100);const now=await page.evaluate(()=>blueStatus.fingerprint);if(now)assert.ok(!before.played.includes(now),'reload must not show prior pixels under another URL');}
 assert.deepEqual(errors,[]);console.log('PASS: pixel duplicates, persisted history, no click skip, Capitol exclusions, mobile viewport');
}finally{await browser.close();}
