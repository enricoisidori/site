// Public-network diagnostic in an isolated WebKit page; does not open the app.
// Requires: node <playwright>/cli.js install webkit
import {readFile} from 'node:fs/promises';
const {webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const catalog=JSON.parse(await readFile(new URL('./catalogs/blueness.json',import.meta.url),'utf8'));
const flow=await readFile(new URL('./blue-flow.js',import.meta.url),'utf8'),detector=flow.slice(flow.indexOf('function colorTest('),flow.indexOf('// Hysteresis in space'));
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 await page.route('https://isolated-media.test/',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Public video diagnostics</title>'}));await page.goto('https://isolated-media.test/');
 await page.addScriptTag({content:`const stills=false,settings={size:50,hue:25,saturation:55,brightness:45,redMax:40,greenMax:65,rgbDistance:210,disturbance:20,minZoom:.5,maxZoom:8,quality:640,motionStep:18,trackingTolerance:15};const analysis=document.createElement('canvas'),ac=analysis.getContext('2d',{willReadFrequently:true}),roiCanvas=document.createElement('canvas'),roiContext=roiCanvas.getContext('2d',{willReadFrequently:true}),analysisStats={full:0,roi:0},integralSums=new Uint32Array(641*641);\n`+detector});
 for(const item of catalog.filter(x=>x.provider==='commons')){
  const result=await page.evaluate(async item=>{
   const started=performance.now(),url=item.url;let video,response;const out={id:item.id||item.title};
   try{
    response=await fetch(url,{headers:{Range:'bytes=0-1'},signal:AbortSignal.timeout(8000)});out.range={status:response.status,bytes:response.headers.get('content-length'),url:response.url};await response.body?.cancel();
    video=document.createElement('video');video.muted=true;video.playsInline=true;video.crossOrigin='anonymous';video.style.cssText='width:320px;height:180px';document.body.append(video);
    const ready=new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error(video.error?.message||'video error')),{once:true});setTimeout(()=>reject(Error('decode timeout')),8000);});video.src=response.url;void video.play().catch(()=>{});await ready;out.loadedMs=Math.round(performance.now()-started);
    const c=document.createElement('canvas');c.width=c.height=8;const ctx=c.getContext('2d');ctx.drawImage(video,0,0,8,8);ctx.getImageData(0,0,8,8);out.readPixels=true;video.pause();
    if(item.startTime){const seek=new Promise((resolve,reject)=>{video.addEventListener('seeked',resolve,{once:true});setTimeout(()=>reject(Error('seek timeout')),3000);});video.currentTime=item.startTime;await seek;}
    const match=detect(video);out.blueMatch=!!match;out.matchedMs=Math.round(performance.now()-started);out.time=video.currentTime;await video.play();
    await new Promise(resolve=>setTimeout(resolve,400));out.advanced=video.currentTime>out.time;
   }catch(error){out.error=error.name+': '+error.message;}finally{if(video){video.pause();video.removeAttribute('src');video.load();video.remove();}}
   return out;
  },item);console.log(JSON.stringify(result));
 }
}finally{await browser.close();}
