// Store only a small compressed source plus its displayed placement. Encoding
// and the external MP4 library are deferred until G, never run during viewing.
function createStillsExporter({container,getScene,pause,resume,isPaused}){
 const records=[],seen=new Set();let exporting=false,controller=null;
 let seconds=.3;try{const saved=Number(localStorage.getItem('blueness-stills:mp4-seconds'));if(saved>=.1&&saved<=2)seconds=Math.round(saved*10)/10;}catch{}
 const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent='esportazione MP4';group.append(summary);
 const label=document.createElement('label'),caption=document.createElement('span'),value=document.createElement('output'),input=document.createElement('input');caption.textContent='secondi per immagine';Object.assign(input,{type:'range',min:'.1',max:'2',step:'.1',value:seconds});input.setAttribute('aria-label','secondi per immagine MP4');input.dataset.stillsDuration='';value.textContent=seconds.toFixed(1);label.append(caption,value,input);group.append(label);
 input.oninput=()=>{value.textContent=Number(input.value).toFixed(1);};input.onchange=()=>{seconds=Math.max(.1,Math.min(2,Math.round(Number(input.value)*10)/10));try{localStorage.setItem('blueness-stills:mp4-seconds',seconds);}catch{}if(!exporting)ready();};
 const button=document.createElement('button');button.textContent='scarica MP4 · g';button.onclick=()=>void exportVideo();button.dataset.stillsExport='';group.append(button);
 const status=document.createElement('p');status.setAttribute('role','status');status.dataset.stillsExportStatus='';group.append(status);container.append(group);
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
  records.push({blob,frame,layout});if(!exporting)ready();
 }
 async function exportVideo(){
  if(exporting)return;if(!records.length){status.textContent='nessuna immagine vista';return;}
  exporting=true;button.disabled=true;input.disabled=true;const snapshot=records.slice(),duration=seconds,wasPaused=isPaused();controller=new AbortController();if(!wasPaused)pause();
  try{
   status.textContent='preparazione MP4 · '+snapshot.length+' immagini';
   const blob=await renderScreenReel(snapshot,{width:1080,height:1440,frameSeconds:duration,signal:controller.signal,onProgress:(text,detail)=>{status.textContent=text+(detail.progress==null?'':' · '+Math.round(detail.progress*100)+'%');}});
   saveRecordingFile(blob,'blueness-stills.mp4');status.textContent='download MP4 avviato · '+snapshot.length+' immagini · 1080 × 1440 px · '+(snapshot.length*duration).toFixed(1)+' s';
  }catch(error){status.textContent=controller.signal.aborted?'esportazione annullata':'errore MP4 · '+error.message;}
  finally{exporting=false;controller=null;button.disabled=false;input.disabled=false;if(!wasPaused)resume();}
 }
 document.addEventListener('keydown',event=>{if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.('input:not([type="range"]),textarea,select,[contenteditable="true"]'))return;const key=event.key.toLowerCase();if(key==='g'){event.preventDefault();void exportVideo();}if(key==='q'&&exporting){event.preventDefault();controller.abort();}});
 Object.defineProperty(window,'blueStillsExportStatus',{get:()=>({images:records.length,exporting,seconds,width:1080,height:1440})});
 return {capture};
}
