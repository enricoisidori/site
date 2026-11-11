// Screen export is dormant until G. No media downloads or decoders while viewing.
const MEDIA_LIBRARY='https://cdn.jsdelivr.net/npm/mediabunny@1.61.6/dist/bundles/mediabunny.min.mjs';
let mediaLibrary;
function loadMediaLibrary(){return mediaLibrary??=import(MEDIA_LIBRARY).catch(error=>{mediaLibrary=null;throw error;});}
export function saveRecordingFile(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export function renderRecordedLayout(ctx,media,key,width,height){
 const {frame,layout}=key;ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);ctx.save();ctx.scale(width/frame.width,height/frame.height);ctx.translate(-frame.x,-frame.y);
 const sw=media.width||media.videoWidth,sh=media.height||media.videoHeight;
 for(const layer of layout.layers){
  const {clip,source:s,destination:d,border}=layer;ctx.save();if(clip){ctx.beginPath();ctx.rect(clip.x,clip.y,clip.width,clip.height);ctx.clip();}
  ctx.drawImage(media,s.x*sw,s.y*sh,s.width*sw,s.height*sh,d.x,d.y,d.width,d.height);
  if(border){ctx.lineWidth=border.lineWidth;ctx.strokeStyle=border.color;ctx.strokeRect(border.x,border.y,border.width,border.height);}ctx.restore();
 }ctx.restore();
}
async function makeOutput(width,height,audio,fps=30){
 const B=await loadMediaLibrary(),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const target=new B.BufferTarget(),output=new B.Output({target,format:new B.Mp4OutputFormat({fastStart:'in-memory'})});
 const video=new B.CanvasSource(canvas,{codec:'avc',bitrate:Math.min(32000000,Math.max(8000000,width*height*12)),bitrateMode:'variable',latencyMode:'quality'});
 output.addVideoTrack(video,{frameRate:fps});const sound=audio?new B.AudioSampleSource({codec:'aac',bitrate:256000}):null;if(sound)output.addAudioTrack(sound);
 await output.start();return {B,canvas,ctx:canvas.getContext('2d',{alpha:false}),target,output,video,sound};
}
function checkCancelled(signal){signal?.throwIfAborted();}
async function sourceCandidates(source,signal){
 let urls=(source.variants||[]).filter(v=>v.src).sort((a,b)=>(Number(b.height)||0)-(Number(a.height)||0)).map(v=>v.src);
 if(source.commonsTitle){try{const p=new URLSearchParams({action:'query',format:'json',origin:'*',prop:'videoinfo',titles:source.commonsTitle,viprop:'url|size|derivatives'}),r=await fetch('https://commons.wikimedia.org/w/api.php?'+p,{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)].filter(Boolean))});if(!r.ok)throw Error('metadati non disponibili');const data=await r.json(),info=Object.values(data.query?.pages||{})[0]?.videoinfo?.[0];if(info)urls=[...(info.derivatives||[]),{src:info.url,height:info.height}].filter(v=>v.src&&/\.(webm|mp4|mov)(?:$|\?)/i.test(v.src)).sort((a,b)=>(Number(b.height)||0)-(Number(a.height)||0)).map(v=>v.src).concat(urls);}catch(error){if(signal?.aborted)throw error;}}
 if(source.archiveID){
  try{
   const response=await fetch('https://archive.org/metadata/'+encodeURIComponent(source.archiveID),{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)].filter(Boolean))});if(!response.ok)throw Error('metadati non disponibili');
   const {files=[]}=await response.json(),byName=new Map(files.map(f=>[f.name,f]));
   const root=name=>{const seen=new Set();while(byName.get(name)?.original&&!seen.has(name)){seen.add(name);name=byName.get(name).original;}return name;};
   const parent=root(source.filename),baseLength=Number(byName.get(source.filename)?.length)||0;
   urls=files.filter(f=>/\.(mp4|webm|mov)$/i.test(f.name)&&!f.private&&root(f.name)===parent&&(!baseLength||!Number(f.length)||Math.abs(Number(f.length)-baseLength)<1)).sort((a,b)=>(Number(b.height)||0)-(Number(a.height)||0)||Number(b.size)-Number(a.size)).map(f=>'https://archive.org/cors/'+encodeURIComponent(source.archiveID)+'/'+f.name.split('/').map(encodeURIComponent).join('/')).concat(urls);
  }catch(error){if(signal?.aborted)throw error;}
 }
 return [...new Set([...urls,source.url].filter(Boolean))];
}
async function openSource(B,source,signal){
 let error;
 for(const url of await sourceCandidates(source,signal)){
  checkCancelled(signal);let input;
  try{input=new B.Input({formats:B.ALL_FORMATS,source:new B.UrlSource(url,{maxCacheSize:32*1024*1024,getRetryDelay:attempt=>attempt<2?1:null,fetchFn:(url,init)=>fetch(url,{...init,signal:AbortSignal.any([signal,init?.signal].filter(Boolean))})})});const track=await input.getPrimaryVideoTrack();if(!track||!await track.canDecode())throw Error('codec non decodificabile');return {input,track,url};}
  catch(e){input?.dispose();error=e;}
 }
 throw Error('sorgente non disponibile: '+(error?.message||source.url));
}
export async function renderScreenReel(items,{width,height,frame,getImage,signal,onProgress=()=>{}}){
 let job;
 try{
  onProgress('caricamento motore MP4…',{stage:'preparation',total:items.length,completed:0,progress:null});job=await makeOutput(width,height,false,8);let index=0;const duration=1/8;
  for(const item of items){checkCancelled(signal);let image;if(getImage)image=await getImage(item);else if(item.blob)image=await createImageBitmap(await item.blob);else if(item.preview)image=await createImageBitmap(await(await fetch(item.preview)).blob());else if(item.source){const opened=await openSource(job.B,item.source,signal);try{const sample=await new job.B.CanvasSink(opened.track).getCanvas(item.time||0);if(sample)image=await createImageBitmap(sample.canvas);}finally{opened.input.dispose();}}if(!image)throw Error('fotogramma della cronologia non disponibile');
   try{const layout=item.layout||{layers:[{source:{x:0,y:0,width:1,height:1},destination:{x:0,y:0,width:innerWidth,height:innerHeight}}]};renderRecordedLayout(job.ctx,image,{frame,layout},width,height);await job.video.add(index*duration,duration,{keyFrame:true});}
   finally{image.close?.();}index++;onProgress(`screen ${index} / ${items.length}`,{stage:'encoding',completed:index,total:items.length,progress:Math.min(.99,index/items.length)});
  }
  checkCancelled(signal);onProgress('finalizzazione del file MP4…',{stage:'finalizing',progress:.99});await job.output.finalize();checkCancelled(signal);return new Blob([job.target.buffer],{type:'video/mp4'});
 }catch(error){if(job)await job.output.cancel().catch(()=>{});throw error;}finally{if(job)job.canvas.width=job.canvas.height=0;}
}
