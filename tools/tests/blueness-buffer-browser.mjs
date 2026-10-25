import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const images=await page.evaluate(()=>Array.from({length:160},(_,i)=>{
  const c=document.createElement('canvas');c.width=160;c.height=100;
  const x=c.getContext('2d');x.fillStyle=`rgb(${i%80},${Math.floor(i/80)*30},255)`;x.fillRect(0,0,160,100);
  return c.toDataURL('image/png').split(',')[1];
 }));
 // A ready image must have completed decode, not just its load event.
 await page.addInitScript(()=>{
  const decode=HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode=async function(){await decode.call(this);await new Promise(resolve=>setTimeout(resolve,120));this.dataset.decoded='1';};
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
   if(image instanceof HTMLImageElement&&!image.dataset.decoded)throw Error('image used before decode completed');
   return draw.call(this,image,...args);
  };
  window.bufferSamples=[];let lastShown=0;
  setInterval(()=>{if(window.blueStatus&&blueStatus.shown!==lastShown){lastShown=blueStatus.shown;bufferSamples.push({shown:lastShown,ready:blueStatus.ready.image,at:performance.now(),fingerprint:blueStatus.fingerprint});}},10);
 });
 let searches=0,liveLoads=0,sequence=0;
 await page.route('https://archive.org/advancedsearch.php?**',r=>{
  searches++;const params=new URL(r.request().url()).searchParams,cb=params.get('callback');
  const data={response:{numFound:10000,docs:Array.from({length:50},()=>({identifier:'buffer-live-'+sequence++}))}};
  return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{headers:{'Access-Control-Allow-Origin':'*'},json:data});
 });
 await page.route('https://archive.org/cors/**',async r=>{
  const index=Number(r.request().url().match(/buffer-live-(\d+)/)?.[1]||0);liveLoads++;
  await new Promise(resolve=>setTimeout(resolve,650));
  if(page.isClosed())return;
  return r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'image/png',body:Buffer.from(images[index%160],'base64')}).catch(()=>{});
 });
 await page.goto(new URL('../../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.locator('#blueness-intro').click({position:{x:10,y:10}});
 await page.waitForFunction(()=>bufferSamples.length>=16,{},{timeout:16000});
 await page.keyboard.press('Space');
 const samples=await page.evaluate(()=>bufferSamples);
 assert.ok(samples.length>=16,'playback must start as soon as images become ready');
 assert.ok(Math.max(...samples.map(s=>s.ready))<=12,'ready buffer must remain bounded');
 const gaps=samples.slice(1).map((s,i)=>s.at-samples[i].at);
 assert.ok(Math.max(...gaps)<450,'4 fps playback must continue despite slow network responses');
 assert.equal(new Set(samples.map(s=>s.fingerprint)).size,samples.length,'shown pixels must remain unique');
 assert.ok(searches>0&&liveLoads>=4,'live search and image verification must continue alongside reserve loads');
 await page.waitForFunction(()=>blueStatus.ready.image===12);
 const decodedErrors=await page.evaluate(()=>blueStatus.error);
 assert.equal(decodedErrors,'');assert.equal(await page.evaluate(()=>blueStatus.phase),'live','only live images must feed the ready buffer');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,shown:samples.length,minimumReady:Math.min(...samples.map(s=>s.ready)),maximumGapMs:Math.round(Math.max(...gaps)),searches,liveLoads,pausedReady:12}));
}finally{await browser.close();}
