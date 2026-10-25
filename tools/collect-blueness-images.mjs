// Run separately from playback; only verified URLs are embedded, never image bytes.
import {readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const destination=new URL('./catalogs/blueness-images.json',import.meta.url),items=new Map();
try{for(const item of JSON.parse(await readFile(destination,'utf8')))items.set(item.fingerprint||item.source,item);}catch{}
const seconds=Number(process.argv[2])||300,target=Number(process.argv[3])||120;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.goto(new URL('../blueness-image/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 const start=Date.now();let report=0;
 while(Date.now()-start<seconds*1000&&items.size<target){
  await page.waitForTimeout(1000);
  const state=await page.evaluate(()=>blueStatus);
  for(const item of state.verifiedImages||[])items.set(item.fingerprint||item.source,item);
  await writeFile(destination,JSON.stringify([...items.values()],null,2)+'\n');
  if(Date.now()-start-report>15000){report=Date.now()-start;console.log(Math.round(report/1000)+'s: '+items.size+' immagini verificate; '+JSON.stringify(state.search));}
 }
 console.log('Raccolta: '+items.size+' immagini verificate.');
}finally{await browser.close();}
