// All rasterization, source extraction and encoding here run only on V exports.
async function buildBluenessIntroRecords(spec,{long=false,signal}={}){
 if(!spec?.startup?.frames?.length)return [];
 const recorded=!!spec.sequence.length;let sequence=spec.sequence;
 if(long||!sequence.length){
  const pool=[...spec.startup.frames];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  sequence=(long?pool:pool.slice(0,12)).map((item,index)=>({item,scene:spec.scene,at:index*50}));
 }
 const sheet=new Image();sheet.src=spec.startup.image;await sheet.decode();const records=[];
 try{
  for(let index=0;index<sequence.length;index++){
   signal?.throwIfAborted();const {item,scene,at}=sequence[index],m=item.match,t=item.tile,b=item.imageBox||{x:0,y:0,width:t.size,height:t.size};
   const c=document.createElement('canvas');c.width=Math.max(1,Math.round(b.width));c.height=Math.max(1,Math.round(b.height));
   c.getContext('2d').drawImage(sheet,t.x+b.x,t.y+b.y,b.width,b.height,0,0,c.width,c.height);
   const blob=await new Promise((resolve,reject)=>c.toBlob(result=>result?resolve(result):reject(Error('fotogramma intro non disponibile')),'image/jpeg',.9));c.width=c.height=0;
   const frameHeight=Math.min(scene.height,scene.width/(3/4)),frameWidth=frameHeight*3/4,frame={x:(scene.width-frameWidth)/2,y:(scene.height-frameHeight)/2,width:frameWidth,height:frameHeight},zoom=scene.size/m.side;
   const layout={layers:scene.screens.map(({x,y,w,h,square})=>({clip:{x,y,width:w,height:h},source:square?{x:(m.x-b.x-m.side/2)/b.width,y:(m.y-b.y-m.side/2)/b.height,width:m.side/b.width,height:m.side/b.height}:{x:0,y:0,width:1,height:1},destination:square?{x:x+w/2-scene.size/2,y:y+h/2-scene.size/2,width:scene.size,height:scene.size}:{x:x+w/2-(m.x-b.x)*zoom,y:y+h/2-(m.y-b.y)*zoom,width:b.width*zoom,height:b.height*zoom}}))};
   const first=scene.screens[0];
   records.push({blob,frame,layout,introSVG:true,aperture:{x:first.x+first.w/2,y:first.y+first.h/2,size:scene.size},seconds:long?.1:Math.max(1/60,((sequence[index+1]?.at??(recorded?spec.endAt:5000))-at)/1000),source:{provider:'archive',id:decodeURIComponent(new URL(item.source).pathname.split('/').filter(Boolean).at(-1)),page:item.source}});
  }
 }finally{sheet.src='';}
 return records;
}
async function renderBluenessIntroReel(items,{width=1080,height=1440,frameSeconds=.1,getImage,signal,onProgress=()=>{},svgText}={}){
 let job;const overlays=new Map();
 try{
  onProgress('caricamento motore MP4…',{progress:null});job=await makeOutput(width,height,false,60);let at=0,index=0;
  for(const item of items){
   checkCancelled(signal);const image=getImage?await getImage(item):await createImageBitmap(await item.blob);
   try{
    const layout=item.introSVG?{layers:item.layout.layers.map(layer=>({...layer,border:null}))}:item.layout;
    renderRecordedLayout(job.ctx,image,{frame:item.frame,layout},width,height);
    if(item.introSVG){
     const scale=width/item.frame.width,a=item.aperture||{x:item.frame.x+item.frame.width/2,y:item.frame.y+item.frame.height/2,size:50},cx=(a.x-item.frame.x)*scale,cy=(a.y-item.frame.y)*scale,size=a.size*scale,key=[cx,cy,size,scale].join(':');
     let overlay=overlays.get(key);
     if(!overlay){
      const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;';host.innerHTML=svgText;document.body.append(host);
      try{
       const svg=host.querySelector('svg');layoutBluenessIntro(svg,width,height,size,{x:cx-width/2,y:cy-height/2,w:width,h:height},scale);
       overlay=new Image();overlay.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await overlay.decode();overlays.set(key,overlay);
      }finally{host.remove();}
     }
     job.ctx.drawImage(overlay,0,0,width,height);
    }
    const duration=Math.max(1/60,item.seconds??frameSeconds);await job.video.add(at,duration,{keyFrame:true});at+=duration;
   }finally{image.close?.();}
   index++;onProgress(`screen ${index} / ${items.length}`,{stage:'encoding',total:items.length,completed:index,progress:Math.min(.99,index/items.length)});
  }
  checkCancelled(signal);onProgress('finalizzazione del file MP4…',{progress:.99});await job.output.finalize();checkCancelled(signal);return new Blob([job.target.buffer],{type:'video/mp4'});
 }catch(error){if(job)await job.output.cancel().catch(()=>{});throw error;}
 finally{for(const overlay of overlays.values())overlay.src='';if(job)job.canvas.width=job.canvas.height=0;}
}
