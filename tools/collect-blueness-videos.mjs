// Offline refresh of the pre-verified Blueness video list (tools/catalogs/blueness.json).
// Never runs in the installation: the page only embeds the resulting list and
// downloads a video when its turn comes.
//
// 1. Discover Commons videos through the API (colour-tagged and general queries).
// 2. Cheap pre-filter: 120px JPEG frames rendered by Commons at given seconds
//    (about 2 KB each), checked with the installation's own blue detector.
// 3. Confirm on the light video transcode at that second, same detector.
//
// Usage: PLAYWRIGHT_MODULE=... node tools/collect-blueness-videos.mjs [target=100] [minutes=15]
import {readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const destination=new URL('./catalogs/blueness.json',import.meta.url);
const target=Math.max(1,Number(process.argv[2])||100),deadline=Date.now()+(Number(process.argv[3])||15)*60000;
const USER_AGENT='BluenessCatalog/1.0 (https://enricoisidori.com/blueness/)';
const SECONDS=[1,3,6,10];

const items=new Map();
try{for(const item of JSON.parse(await readFile(destination,'utf8')))items.set(item.source,item);}catch{}
const initial=items.size;
const flow=await readFile(new URL('./blue-flow.js',import.meta.url),'utf8');
const detector=flow.slice(flow.indexOf('function colorTest('),flow.indexOf('// Hysteresis in space'));
const defaults=flow.match(/const defaults=(\{[^;]+\});/)[1];

const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(params){
 for(let attempt=0;attempt<4;attempt++){
  const response=await fetch('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',...params}),{headers:{'User-Agent':USER_AGENT}});
  if(response.status===429){await wait(1000*(Number(response.headers.get('retry-after'))||10));continue;}
  if(!response.ok)throw Error('Commons HTTP '+response.status);
  return Object.values((await response.json()).query?.pages||{});
 }
 return [];
}
// Same discovery shape as the installation's fetchCommons for video.
async function discover(){
 const tagged=Math.random()<.6,term='(haswbstatement:P462=Q1088 OR incategory:Blue)';
 const pages=await api({generator:'search',gsrsearch:'filetype:video '+(tagged?term:''),gsrnamespace:'6',gsrlimit:'50',gsroffset:String(Math.floor(Math.random()*(tagged?500:9000))),prop:'videoinfo',viprop:'url|mime|derivatives|extmetadata|size',viurlwidth:'120',viextmetadatafilter:'Artist|LicenseShortName'});
 const out=[];
 for(const page of pages){
  const data=page.videoinfo?.[0];if(!data?.thumburl||!data.descriptionurl||items.has(data.descriptionurl))continue;
  const videoVariants=(data.derivatives||[]).filter(d=>d.src&&Number(d.width)>0&&Number(d.width)<=1280&&Number(d.height)<=720&&!/mp4v/.test(d.type||'')).map(({src,type,width,height,bandwidth})=>({src,type,width,height,bandwidth}));
  const light=videoVariants.filter(d=>/webm/.test(d.type||'')&&Number(d.height)<=360).sort((a,b)=>a.height-b.height)[0];
  if(!light)continue;
  const meta=data.extmetadata||{},duration=Number(data.duration)||0;
  // thumburl looks like .../120px--File.webm.jpg; Commons renders any second with 120px-seek=N-.
  const frames=SECONDS.filter(at=>!duration||at<duration-.5).map(at=>({at,url:data.thumburl.replace(/\?.*$/,'').replace('thumb.wikimedia.org','upload.wikimedia.org').replace(/\/120px--/,`/120px-seek=${at}-`)}));
  out.push({candidatePolicy:'general-or-color-tag-v1',provider:'commons',url:light.src,lightURL:light.src,frames,title:page.title,source:data.descriptionurl,author:clean(meta.Artist?.value),license:clean(meta.LicenseShortName?.value),kind:'video',videoVariants});
 }
 return out;
}

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('https://blueness-catalog.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Blueness catalog</title>'}));
 await page.goto('https://blueness-catalog.test/');
 await page.addScriptTag({content:`const stills=false,wiki=false,mode='video';const defaults=${defaults};const settings={...defaults};const analysis=document.createElement('canvas'),ac=analysis.getContext('2d',{willReadFrequently:true}),roiCanvas=document.createElement('canvas'),roiContext=roiCanvas.getContext('2d',{willReadFrequently:true}),analysisStats={full:0,roi:0},integralSums=new Uint32Array(641*641);\n${detector}
window.checkFrames=async frames=>{const hits=await Promise.all(frames.map(async frame=>{try{const image=new Image();image.crossOrigin='anonymous';image.src=frame.url;await image.decode();return detect(image)?frame.at:null;}catch{return null;}}));return hits.find(at=>at!==null)??null;};
window.checkVideo=async(url,at)=>{const video=document.createElement('video');video.muted=true;video.crossOrigin='anonymous';video.preload='auto';
 const event=(name,ms)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error(name+' timeout')),ms);video.addEventListener(name,()=>{clearTimeout(t);resolve();},{once:true});video.addEventListener('error',()=>{clearTimeout(t);reject(Error('media error'));},{once:true});});
 try{const loaded=event('loadeddata',12000);video.src=url;await loaded;if(at){const seeked=event('seeked',8000);video.currentTime=at;await seeked;}return !!detect(video);}catch{return false;}finally{video.removeAttribute('src');video.load();}};`});
 let checked=0,prefiltered=0,report=Date.now();
 const save=()=>writeFile(destination,JSON.stringify([...items.values()],null,2)+'\n');
 while(items.size-initial<target&&Date.now()<deadline){
  let batch;try{batch=await discover();}catch(error){console.log('discovery: '+error.message);await wait(5000);continue;}
  // Frames are tiny: eight candidates at once, all their frames in parallel.
  for(let i=0;i<batch.length&&items.size-initial<target;i+=8){
   await Promise.all(batch.slice(i,i+8).map(async candidate=>{
    checked++;const at=await page.evaluate(frames=>window.checkFrames(frames),candidate.frames);if(at===null)return;prefiltered++;
    if(!await page.evaluate(([url,at])=>window.checkVideo(url,at),[candidate.lightURL,at]))return;
    const {frames,lightURL,...item}=candidate;items.set(item.source,{...item,startTime:at,verified:true});
   }));
   await save();
   if(Date.now()-report>15000){report=Date.now();console.log(`${checked} candidates · ${prefiltered} passed frames · ${items.size-initial} new verified (${items.size} total)`);}
  }
 }
 await save();console.log(`done · ${checked} candidates · ${prefiltered} passed frames · ${items.size-initial} new verified · ${items.size} total`);
}finally{await browser.close();}
