import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.context().setOffline(true);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(new URL('../../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.locator('#blueness-intro').waitFor();
 await page.waitForFunction(()=>blueStatus.previewShown>0);await page.screenshot({path:'/private/tmp/blueness-here-mobile.png'});
 const check=async(centerX,centerY,size)=>{
  const box=await page.locator('#blueness-intro [data-blue-anchor]').boundingBox();
  const arrow=await page.locator('[data-intro-arrow]').boundingBox(),text=await page.locator('[data-intro-text]').boundingBox(),viewport=page.viewportSize();
  assert.ok(Math.abs(box.y-arrow.y-arrow.height-16)<.02,'arrow gap must remain exactly 16 CSS px');
  assert.ok(text.x>=15.98&&text.x+text.width<=viewport.width-15.98,'responsive text must fit within page margins');
  for(const [actual,expected]of [[box.x+box.width/2,centerX],[box.y+box.height/2,centerY],[box.width,size],[box.height,size]])assert.ok(Math.abs(actual-expected)<.02,`${actual} must align with ${expected}`);
 };
 for(const viewport of [{width:390,height:844},{width:1280,height:720},{width:391,height:845}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(40);
  await check(viewport.width/2,viewport.height/2,50);
 }
 await page.evaluate(()=>{const input=document.querySelector('input[aria-label="lato quadrato fisso sullo schermo · px"]');input.value='80';input.dispatchEvent(new Event('change'));});
 await check(391/2,845/2,80);
 await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(40);
 await page.screenshot({path:'/private/tmp/blueness-responsive-desktop.png'});
 await page.evaluate(()=>[...document.querySelectorAll('label')].find(label=>label.textContent.includes('simula due schermi 16:9')).querySelector('button').click());
 await check(320,360,80);
 await page.screenshot({path:'/private/tmp/blueness-here-aligned.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: SVG square matches canvas square within 0.02 CSS px on mobile, desktop, odd viewport, size changes and dual layout');
}finally{await browser.close();}
