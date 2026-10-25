import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const images=await page.evaluate(()=>Array.from({length:3},(_,i)=>{const c=document.createElement('canvas');c.width=160;c.height=100;const x=c.getContext('2d');x.fillStyle=`rgb(${i*25},0,255)`;x.fillRect(0,0,160,100);return c.toDataURL().split(',')[1];}));
 await page.addInitScript(()=>{
  localStorage.setItem('blue-controls-v3-stills',JSON.stringify({fps:4}));
  window.livePaints=[];window.introRemovedAt=null;window.stageBorders=[];const stroke=CanvasRenderingContext2D.prototype.strokeRect;CanvasRenderingContext2D.prototype.strokeRect=function(...args){if(this.canvas.id==='stage')stageBorders.push(blueStatus.shown);return stroke.apply(this,args);};
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){const result=draw.apply(this,args);if(this.canvas.id==='stage'&&window.blueStatus?.current){livePaints.push({source:blueStatus.current,shown:blueStatus.shown,at:performance.now(),ready:blueStatus.ready.image,svg:!!document.getElementById('blueness-intro')});}return result;};
  new MutationObserver(records=>{for(const record of records)for(const node of record.removedNodes)if(node.id==='blueness-intro')introRemovedAt={shown:blueStatus.shown,source:blueStatus.current,painted:livePaints.at(-1)?.source};}).observe(document,{subtree:true,childList:true});
 });
 let firstReady=false,secondReady=false,thirdReady=false;
 await page.route('https://archive.org/advancedsearch.php?**',r=>{const cb=new URL(r.request().url()).searchParams.get('callback'),data={response:{numFound:3,docs:(thirdReady?[0,1,2]:secondReady?[0,1]:firstReady?[0]:[]).map(n=>({identifier:'intro-live-'+n}))}};return r.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{headers:{'Access-Control-Allow-Origin':'*'},json:data});});
 await page.route('https://archive.org/cors/**',async r=>{const match=r.request().url().match(/intro-live-(\d)/);if(!match)return r.abort();const index=Number(match[1]);await r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'image/png',body:Buffer.from(images[index],'base64')}).catch(()=>{});});
 await page.goto(new URL('../../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>blueStatus.previewShown>=5);
 await page.waitForTimeout(5100);
 assert.equal(await page.evaluate(()=>blueStatus.shown),0,'preloaded frames must never become live entries');
 const previews=await page.evaluate(()=>blueStatus.previewShown);
 await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>blueStatus.previewShown),previews,'the fast intro must stop at five seconds');
 firstReady=true;
 await page.waitForFunction(()=>blueStatus.shown===1);
 const stopped=await page.evaluate(()=>blueStatus.previewShown);
 assert.equal(await page.evaluate(()=>blueStatus.ready.image),0,'first image starts without a second ready');
 await page.waitForFunction(()=>introRemovedAt!==null);
 assert.equal(await page.locator('#blueness-intro').count(),0,'SVG is removed on the first live image');
 secondReady=true;
 await page.waitForFunction(()=>blueStatus.shown===2);
 await page.waitForFunction(()=>introRemovedAt!==null);
 assert.equal(await page.locator('#blueness-intro').count(),0,'SVG is removed on the second live image');
 assert.equal(await page.evaluate(()=>blueStatus.previewShown),stopped,'local sequence ends on first live');

 const result=await page.evaluate(()=>({removed:introRemovedAt,painted:livePaints,borders:stageBorders}));
 assert.ok(result.painted[0].source.endsWith('/intro-live-0'),'first held image must be a fresh live result');
 assert.ok(result.borders.includes(1),'normal border is present from the first image');assert.ok(result.borders.includes(2),'normal border remains on the second image');
 assert.equal(result.removed.shown,1);assert.equal(result.removed.source,result.removed.painted,'first image must be painted before SVG removal');
 const firstPaints=[1,2].map(shown=>result.painted.find(frame=>frame.shown===shown));
 for(let i=1;i<2;i++)assert.ok(firstPaints[i].at-firstPaints[i-1].at<=1050,'first two changes must take at most one second plus one browser frame, at normal playback speed');
 assert.deepEqual(errors,[]);
 console.log('PASS: no frozen preload after five seconds, first decoded live image ends intro immediately, first change within one second and without border, SVG removed on second paint');
}finally{await browser.close();}
