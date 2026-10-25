// Optional offline catalog refresh. This process never runs in the installation.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const destination=new URL('./catalogs/blueness.json',import.meta.url),items=new Map();
try{for(const item of JSON.parse(await readFile(destination,'utf8')))items.set(item.source,item);}catch{}
const seconds=Math.max(10,Number(process.argv[2])||120),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 // Color tags only improve the scan's yield. Each candidate still must pass
 // the same pixel detector as the installation, with its default tolerances.
 await page.route('https://commons.wikimedia.org/w/api.php?**',route=>{
  const url=new URL(route.request().url());if(url.searchParams.get('generator')==='search'){
   url.searchParams.set('gsrsearch','filetype:video (haswbstatement:P462=Q1088 OR incategory:Blue)');url.searchParams.set('gsroffset',String(Math.floor(Math.random()*500)));
  }return route.continue({url:url.href});
 });
 await page.route('https://archive.org/advancedsearch.php?**',route=>{
  const url=new URL(route.request().url());url.searchParams.set('q','mediatype:movies AND subject:blue AND NOT access-restricted-item:true');return route.continue({url:url.href});
 });
 await page.goto(new URL('../bluenessmovements/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 const started=Date.now();let report=0;
 while(Date.now()-started<seconds*1000){
  await page.waitForTimeout(1200);
  const state=await page.evaluate(()=>({shown:window.blueStatus?.shown,entries:JSON.parse(localStorage.getItem('blue-candidates-v1')||'[]')}));
  for(const item of state.entries)if(item.verified)items.set(item.source,item);
  if(state.shown)await page.keyboard.press('ArrowRight');
  await writeFile(destination,JSON.stringify([...items.values()],null,2)+'\n');
  if(Date.now()-started-report>=15000){report=Date.now()-started;console.log(Math.round(report/1000)+' s · '+items.size+' verified videos');}
 }
 console.log(fileURLToPath(destination)+' · '+items.size+' verified videos');
}finally{await browser.close();}
