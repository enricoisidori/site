// Store only a small compressed source plus its displayed placement. Encoding
// and the external MP4 library are deferred until G, never run during viewing.
function createStillsExporter({name='blueness',container,getScene,getIntro=null,pause,resume,isPaused}){
 const records=[],seen=new Set();let exporting=false,controller=null,aHeld=false,lHeld=false,vHeld=false,vOptions=null,noticeTimer=null;
 const exportFPS=60;let frames=6;try{const saved=Number(localStorage.getItem('blueness:mp4-frames:v1'));if(Number.isInteger(saved)&&saved>=1&&saved<=120)frames=saved;}catch{}
 let seconds=frames/exportFPS;
 const durationText=n=>n.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')+' s';
 const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent='esportazione MP4';group.append(summary);
 const label=document.createElement('label'),caption=document.createElement('span'),value=document.createElement('output'),input=document.createElement('input');caption.textContent='secondi per immagine';Object.assign(input,{type:'range',min:'1',max:'120',step:'1',value:frames});input.setAttribute('aria-label','secondi per immagine MP4');input.dataset.stillsDuration='';value.textContent=durationText(seconds);label.append(caption,value,input);group.append(label);
 input.oninput=()=>{value.textContent=durationText(Number(input.value)/exportFPS);};input.onchange=()=>{frames=Math.max(1,Math.min(120,Math.round(Number(input.value))));seconds=frames/exportFPS;try{localStorage.setItem('blueness:mp4-frames:v1',frames);}catch{}if(!exporting)ready();};
 const button=document.createElement('button');button.textContent='scarica MP4 · g';button.onclick=()=>void exportVideo();button.dataset.stillsExport='';group.append(button);
 const highButton=document.createElement('button');highButton.textContent='scarica MP4 alta risoluzione · a + g';highButton.style.display='block';highButton.onclick=()=>void exportVideo(true);group.append(highButton);
 const introButtons=[];if(getIntro)for(const [label,variant]of [['scarica MP4 con intro · v (a = HD)','intro'],['scarica solo intro estesa · v + l (a = HD)','longIntro']]){const b=document.createElement('button');b.textContent=label;b.style.display='block';b.onclick=()=>void exportVideo(aHeld,variant);group.append(b);introButtons.push(b);}
 const status=document.createElement('p');status.setAttribute('role','status');status.dataset.stillsExportStatus='';group.append(status);container.append(group);
 const feedback=document.createElement('div');feedback.hidden=true;feedback.dataset.stillsExportFeedback='';feedback.setAttribute('role','status');feedback.style.cssText='position:fixed;z-index:2147483647;top:12px;left:16px;max-width:80vw;pointer-events:none;font:12px/1.5 Helvetica,Arial,sans-serif;color:white;text-shadow:0 1px 2px black;white-space:pre-line';document.body.append(feedback);
 function report(text){status.textContent=text;feedback.textContent=text;feedback.hidden=false;}

 function ready(){status.textContent=records.length+' immagini · 1080 × 1440 px · '+(records.length*seconds).toFixed(1)+' s';}ready();
 function capture(){
  const scene=getScene(),entry=scene?.entry;if(!entry?.match||entry.kind!=='image'||seen.has(entry.source))return;
  const m=entry.match,w=entry.media.naturalWidth,h=entry.media.naturalHeight;if(!w||!h)return;
  seen.add(entry.source);
  const bitmap=document.createElement('canvas');bitmap.width=w;bitmap.height=h;bitmap.getContext('2d').drawImage(entry.media,0,0);
  const blob=new Promise((resolve,reject)=>bitmap.toBlob(result=>{bitmap.width=bitmap.height=0;result?resolve(result):reject(Error('immagine non salvabile'));},'image/jpeg',.9));blob.catch(()=>{});
  const frameHeight=Math.min(scene.height,scene.width/(3/4)),frameWidth=frameHeight*3/4;
  const frame={x:(scene.width-frameWidth)/2,y:(scene.height-frameHeight)/2,width:frameWidth,height:frameHeight};
  const layout={layers:scene.screens.map(({x,y,w,h,square})=>{
   const cx=x+w/2,cy=y+h/2,size=scene.size;
   return {clip:{x,y,width:w,height:h},source:square?{x:(m.x-m.side/2)/m.w,y:(m.y-m.side/2)/m.h,width:m.side/m.w,height:m.side/m.h}:{x:0,y:0,width:1,height:1},destination:square?{x:cx-size/2,y:cy-size/2,width:size,height:size}:{x:cx-m.x*m.zoom,y:cy-m.y*m.zoom,width:m.w*m.zoom,height:m.h*m.zoom},border:(!scene.dual&&!scene.second)||scene.showBorder?{x:Math.round(cx-size/2)+.5,y:Math.round(cy-size/2)+.5,width:Math.round(size),height:Math.round(size),color:'#fff',lineWidth:1}:null};
  })};
  const first=scene.screens[0];records.push({blob,frame,layout,introSVG:!!scene.introOverlay,aperture:{x:first.x+first.w/2,y:first.y+first.h/2,size:scene.size},source:{provider:entry.provider,id:entry.id,title:entry.title,page:entry.source}});if(!exporting)ready();
 }
 async function exportVideo(highResolution=false,variant='normal'){
  if(exporting)return;if(!records.length&&variant==='normal'){status.textContent='nessuna immagine vista';return;}
  exporting=true;clearTimeout(noticeTimer);button.disabled=highButton.disabled=input.disabled=true;let snapshot=records.slice();const duration=seconds,wasPaused=isPaused(),introSpec=variant!=='normal'?getIntro?.():null;controller=new AbortController();if(!wasPaused)pause();
  try{
   for(const b of introButtons)b.disabled=true;
   if(introSpec){report('preparazione intro…');const prefix=await buildBluenessIntroRecords(introSpec,{long:variant==='longIntro',signal:controller.signal});snapshot=variant==='longIntro'?prefix:[...prefix,...snapshot];}
   if(!snapshot.length)throw Error('nessun fotogramma disponibile');
   report((highResolution?'alta risoluzione · ':'')+'preparazione MP4 · '+snapshot.length+' immagini');
   let high=0,low=0,index=0;
   const getImage=highResolution?async record=>{
    const position=++index;
    const result=await resolveStillsHighRes(record,{signal:controller.signal,onStatus:text=>report('alta risoluzione · '+position+' / '+snapshot.length+' · '+text)});
    if(result.highRes)high++;else low++;
    report('alta risoluzione · '+position+' / '+snapshot.length+(result.highRes?' · immagine pronta':' · uso miniatura: '+result.reason));return result.image;
   }:undefined;
   const blob=await (introSpec?renderBluenessIntroReel:renderScreenReel)(snapshot,{width:1080,height:1440,frameSeconds:duration,svgText:introSpec?.svg,getImage,signal:controller.signal,onProgress:(text,detail)=>{report((highResolution?'alta risoluzione · ':'')+text+(detail.progress==null?'':' · '+Math.round(detail.progress*100)+'%'));}});
   saveRecordingFile(blob,name+(variant==='intro'?'-intro':variant==='longIntro'?'-intro-long':'')+(highResolution?'-hq':'')+'.mp4');report('download MP4 avviato · '+snapshot.length+' immagini · 1080 × 1440 px · '+snapshot.reduce((sum,item)=>sum+(introSpec?(item.seconds??duration):duration),0).toFixed(1)+' s'+(highResolution?'\n'+high+' immagini HD · '+low+' miniature mantenute':''));
  }catch(error){report(controller.signal.aborted?'esportazione annullata':'errore MP4 · '+error.message);}
  finally{exporting=false;controller=null;button.disabled=highButton.disabled=input.disabled=false;for(const b of introButtons)b.disabled=false;if(!wasPaused)resume();noticeTimer=setTimeout(()=>{feedback.hidden=true;},8000);}
 }
 document.addEventListener('keyup',event=>{const key=event.key.toLowerCase();if(key==='a')aHeld=false;if(key==='l')lHeld=false;if(key==='v'&&vHeld){vHeld=false;const options=vOptions;vOptions=null;if(options)void exportVideo(options.high,options.long?'longIntro':'intro');}});
 addEventListener('blur',()=>{aHeld=lHeld=vHeld=false;vOptions=null;});
 document.addEventListener('keydown',event=>{
  if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.('input:not([type="range"]),textarea,select,[contenteditable="true"]'))return;
  const key=event.key.toLowerCase();
  if(key==='a'){aHeld=true;if(vOptions)vOptions.high=true;}
  if(key==='l'){lHeld=true;if(vOptions)vOptions.long=true;}
  if(key==='v'&&getIntro){event.preventDefault();vHeld=true;vOptions={high:aHeld,long:lHeld};}
  if(key==='g'){event.preventDefault();void exportVideo(aHeld);}
  if(key==='q'&&exporting){event.preventDefault();controller.abort();}
 });
 Object.defineProperty(window,'blueStillsExportStatus',{get:()=>({images:records.length,exporting,seconds,width:1080,height:1440})});
 return {capture};
}
