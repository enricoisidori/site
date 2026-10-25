import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const images=await page.evaluate(()=>Array.from({length:161},(_,i)=>{
  const c=document.createElement('canvas');c.width=160;c.height=100;const x=c.getContext('2d');
  x.fillStyle=i===160?'red':`rgb(${i%80},${Math.floor(i/80)*30},255)`;x.fillRect(0,0,160,100);return c.toDataURL().split(',')[1];
 }));
 await page.addInitScript(()=>{
  window.localDecodes=0;const decode=HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode=function(){if(this.src.startsWith('data:'))localDecodes++;return decode.call(this);};
  window.liveSamples=[];let shown=0;
  setInterval(()=>{if(window.blueStatus&&blueStatus.shown!==shown){shown=blueStatus.shown;liveSamples.push(blueStatus.current);}},10);
 });
 let serial=0,active=0,peak=0,liveAvailable=true;
 await page.route('https://archive.org/advancedsearch.php?**',r=>{
  const params=new URL(r.request().url()).searchParams,cb=params.get('callback');
  const data={response:{numFound:10000,docs:Array.from({length:50},()=>({identifier:'live-priority-'+serial++}))}};
  return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{headers:{'Access-Control-Allow-Origin':'*'},json:data});
 });
 await page.route('https://archive.org/cors/**',async r=>{
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,350));active--;
  const id=Number(r.request().url().match(/live-priority-(\d+)/)?.[1]||0);
  await r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'image/png',body:Buffer.from(images[liveAvailable?id%160:160],'base64')}).catch(()=>{});
 });
 await page.goto(new URL('../../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>blueStatus.shown>=5);
 await page.keyboard.press('Space');
 await page.waitForFunction(()=>blueStatus.ready.image===12);
 const before=await page.evaluate(()=>localDecodes);
 assert.equal(before,1,'intro must decode only one compact sheet');
 assert.equal(peak,8,'all eight normal download lanes must be available to live images');
 assert.equal(await page.locator('#blueness-intro').count(),0,'SVG must already be gone after the third live image');
 await page.keyboard.press('Space');
 await page.waitForFunction(()=>blueStatus.shown>=16);
 const result=await page.evaluate(()=>({sources:liveSamples,decodes:localDecodes}));
 assert.ok(result.sources.length>=15);
 const liveStart=result.sources.findIndex(source=>source.includes('live-priority-'));
 assert.ok(liveStart>=0&&liveStart<=2,'live must take over after the brief local start');
 assert.ok(result.sources.slice(liveStart).every(source=>source.includes('live-priority-')),'once live is healthy, reserve images must stop appearing');
 assert.equal(result.decodes,before,'intro must never decode more sheets during live playback');
 const introCount=await page.evaluate(()=>blueStatus.previewShown);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>blueStatus.previewShown),introCount,'intro frames must stop once live starts');
 assert.equal(await page.evaluate(()=>blueStatus.phase),'live');
 liveAvailable=false;
 await page.waitForFunction(()=>blueStatus.ready.image===0,{},{timeout:10000});
 const held=await page.evaluate(()=>({source:blueStatus.current,shown:blueStatus.shown}));
 await page.waitForTimeout(900);
 assert.equal(await page.evaluate(()=>localDecodes),before,'live shortage must not restart the local reserve after transition');
 assert.equal(await page.evaluate(()=>blueStatus.shown),held.shown,'hold the last live image while searching');
 assert.equal(await page.evaluate(()=>blueStatus.current),held.source);
 console.log(JSON.stringify({pass:true,liveImages:result.sources.length,reserveDecodes:before,peakLiveDownloads:peak,noReserveAfterLive:true}));
}finally{await browser.close();}
