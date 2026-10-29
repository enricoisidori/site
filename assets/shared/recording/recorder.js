import { createMP4Muxer } from './mp4-muxer.js';
import { renderScreenReel, saveRecordingFile } from './render.js';

const recorderPanels=new Map();
export function recordingControlsHTML(name){return recorderPanels.get(name)?.controlsHTML()||'';}

// No encoder, audio processing or animation loop exists until R is pressed.
export function createSelectiveRecorder({name,getScene,getSnapshots=async()=>[],getScreenIntro=null,suspendPlayback=()=>()=>{}}){
 let phase='idle',clip=null,clips=[],pending=[],timer=null,hudTimer=null,started=0,serial=0;
 let surface,context,videoConfig,audioConfig,audioContext;const playbackTaps=new WeakMap();
 let stopPromise=null,cancelPromise=null,notice='',saved=0,selectPending=false,selectedCount=0,sessionId=0;
 let renderAbort=null,exportPromise=null,exportTimer=null;
 let exportState={stage:'idle',kind:'',message:'nessuna esportazione in corso',progress:null,completed:0,total:0,startedAt:null};
 const escapeStatus=value=>String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 function exportStatusText(){const s=exportState,elapsed=s.startedAt?Math.floor(((s.endedAt||performance.now())-s.startedAt)/1000):0;return 'mp4 · '+s.message+(s.kind?'\n'+(s.kind==='screens'?'screen':'registrazione')+' · '+s.width+' × '+s.height+' px':'')+(s.total?' · '+s.completed+' / '+s.total+(s.kind==='screens'?' screen':' video')+' completati':'')+(s.progress==null?'':' · '+Math.floor(s.progress*100)+'%')+(s.startedAt?' · '+elapsed+' s':'');}
 function syncExportStatus(){const text=exportStatusText();document.querySelectorAll('[data-mp4-status="'+name+'"]').forEach(el=>{if(el.textContent!==text)el.textContent=text;el.dataset.stage=exportState.stage;});}
 function exportProgress(text,detail={}){Object.assign(exportState,detail,{message:text});if(['complete','error','cancelled','ready','empty'].includes(exportState.stage)){exportState.endedAt=performance.now();clearInterval(exportTimer);exportTimer=null;}syncExportStatus();message(text);}
 function beginExport(kind,width,height,total=0){clearInterval(exportTimer);exportState={kind,width,height,total,completed:0,progress:null,stage:'preparation',message:'preparazione…',startedAt:performance.now()};syncExportStatus();exportTimer=setInterval(syncExportStatus,1000);}
 const sizeKey=name+':recording-size:v1';let dimensions={width:1080,height:1440},crop={heightVH:100,centerX:50,centerY:50};
 const dimension=(value,fallback)=>Number.isFinite(Number(value))?Math.max(128,Math.min(4096,Math.round(Number(value)/2)*2)):fallback;
 const percent=(value,fallback)=>Number.isFinite(Number(value))?Math.max(1,Math.min(100,Number(value))):fallback;
 try{const stored=JSON.parse(localStorage.getItem(sizeKey)||'null');if(stored){dimensions={width:dimension(stored.width,1080),height:dimension(stored.height,1440)};if(stored.crop)for(const key of Object.keys(crop))crop[key]=percent(stored.crop[key],crop[key]);}}catch{}
 function frameRectangle(){
  const aspect=dimensions.width/dimensions.height,h=Math.min(innerHeight*crop.heightVH/100,innerWidth/aspect),w=h*aspect;
  const cx=Math.max(w/2,Math.min(innerWidth-w/2,innerWidth*crop.centerX/100)),cy=Math.max(h/2,Math.min(innerHeight-h/2,innerHeight*crop.centerY/100));
  return {x:cx-w/2,y:cy-h/2,width:w,height:h};
 }
 const inputStyle='font:inherit;color:inherit;background:transparent;border:0;border-bottom:1px solid #888;width:7ch;padding:0';
 function aspectValue(){return ['3:4','4:3','16:9','9:16','1:1'].find(r=>{const [w,h]=r.split(':').map(Number);return Math.abs(dimensions.width/dimensions.height-w/h)<.002;})||'custom';}
 function controlsHTML(){
  const r=frameRectangle(),values={heightVH:r.height/innerHeight*100,widthVW:r.width/innerWidth*100,centerX:(r.x+r.width/2)/innerWidth*100,centerY:(r.y+r.height/2)/innerHeight*100};
  return `<p data-mp4-status="${name}" data-stage="${exportState.stage}" role="status" style="white-space:pre-line">${escapeStatus(exportStatusText())}</p><details data-section="recording" data-recording="${name}"><summary>registrazione MP4</summary>
  <label>proporzioni <select data-recording-aspect ${phase!=='idle'?'disabled':''}>${['3:4','4:3','16:9','9:16','1:1','custom'].map(a=>`<option value="${a}" ${a===aspectValue()?'selected':''}>${a==='custom'?'personalizzate':a}</option>`).join('')}</select></label>
  ${[['heightVH','altezza area · vh'],['widthVW','larghezza area · vw'],['centerX','centro x · vw'],['centerY','centro y · vh']].map(([key,label])=>`<label>${label} <input data-recording-crop="${key}" type="number" min="1" max="100" step="1" value="${Number(values[key].toFixed(2))}" style="${inputStyle}"></label>`).join('')}
  ${['width','height'].map(key=>`<label>output ${key==='width'?'larghezza':'altezza'} · px <input data-recording-dimension="${key}" type="number" min="128" max="4096" step="2" value="${dimensions[key]}" ${phase!=='idle'?'disabled':''} style="${inputStyle}"></label>`).join('')}
  <p><button type="button" data-recording-action="screens">screen MP4 · g</button></p>
  ${getScreenIntro?'<p><button type="button" data-recording-action="intro">screen MP4 con intro · v</button></p>':''}
  <p>il riquadro mostra l’area registrata · pannelli, bordo e feedback esclusi<br>r avvia / salva · g screen MP4 · spazio pausa · q annulla · s seleziona · d deseleziona · x / → taglia</p></details>`;
 }
 function syncControls(){
  const r=frameRectangle(),values={heightVH:r.height/innerHeight*100,widthVW:r.width/innerWidth*100,centerX:(r.x+r.width/2)/innerWidth*100,centerY:(r.y+r.height/2)/innerHeight*100};
  document.querySelectorAll('[data-recording="'+name+'"] input,[data-recording="'+name+'"] select').forEach(input=>{
   const key=input.dataset.recordingDimension||input.dataset.recordingCrop;
   input.disabled=input.hasAttribute('data-recording-crop')?!['idle','recording'].includes(phase):phase!=='idle';
   input.value=input.hasAttribute('data-recording-aspect')?aspectValue():input.dataset.recordingDimension?dimensions[key]:Number(values[key].toFixed(2));
  });updateFrame();syncExportStatus();
 }
 document.addEventListener('change',event=>{
  const input=event.target;if(input.closest('[data-recording]')?.dataset.recording!==name)return;
  if(phase==='idle'&&input.dataset.recordingDimension){const key=input.dataset.recordingDimension;if(['width','height'].includes(key))dimensions[key]=dimension(input.value,dimensions[key]);}
  if(phase==='idle'&&input.hasAttribute('data-recording-aspect')&&input.value!=='custom'){
   const [w,h]=input.value.split(':').map(Number);if(w&&h){const ratio=w/h;let height=dimensions.height,width=height*ratio;if(width>4096){width=4096;height=width/ratio;}dimensions={width:dimension(width,1080),height:dimension(height,1440)};}
  }
  if(['idle','recording'].includes(phase)&&input.dataset.recordingCrop){const key=input.dataset.recordingCrop,value=percent(input.value,50);if(key==='widthVW')crop.heightVH=percent(innerWidth*value/100/(dimensions.width/dimensions.height)/innerHeight*100,100);else if(key in crop)crop[key]=value;const r=frameRectangle();crop.centerX=(r.x+r.width/2)/innerWidth*100;crop.centerY=(r.y+r.height/2)/innerHeight*100;}
  try{localStorage.setItem(sizeKey,JSON.stringify({...dimensions,crop}));}catch{}syncControls();
 });
 document.addEventListener('click',event=>{const button=event.target.closest('[data-recording-action]');if(button?.closest('[data-recording]')?.dataset.recording!==name)return;void exportScreens(button.dataset.recordingAction==='intro');});
 recorderPanels.set(name,{controlsHTML});
 const outline=document.createElement('div');outline.dataset.recordingFrame=name;outline.hidden=true;
 outline.style.cssText='position:fixed;z-index:2;pointer-events:none;box-sizing:border-box;border:1px solid white;outline:1px solid #0008';
 const frameLabel=document.createElement('span');frameLabel.style.cssText='position:absolute;left:5px;top:3px;color:white;text-shadow:0 1px 2px black;font:12px/1.4 Helvetica,Arial,sans-serif;white-space:nowrap';outline.append(frameLabel);document.body.append(outline);
 function updateFrame(){
  const r=frameRectangle();outline.hidden=!(['starting','recording'].includes(phase)||document.querySelector('#controls:not([hidden]),#info:not([hidden])'));
  Object.assign(outline.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});
  frameLabel.textContent=Number((r.width/innerWidth*100).toFixed(1))+'vw × '+Number((r.height/innerHeight*100).toFixed(1))+'vh · '+dimensions.width+' × '+dimensions.height+'px';
 }
 const panelObserver=new MutationObserver(updateFrame);for(const selector of ['#controls','#info']){const panel=document.querySelector(selector);if(panel)panelObserver.observe(panel,{attributes:true,attributeFilter:['hidden','open'],childList:true,subtree:true});}
 addEventListener('resize',syncControls);
 const hud=document.createElement('div');hud.hidden=true;hud.setAttribute('role','status');
 hud.style.cssText='position:fixed;z-index:2147483647;top:10px;left:50%;transform:translateX(-50%);pointer-events:none;font:12px/1.4 Helvetica,Arial,sans-serif;color:white;text-shadow:0 1px 3px black;white-space:nowrap';
 const dot=document.createElement('span');dot.textContent='● ';dot.style.color='#f22';
 const feedback=document.createElement('span'),counter=document.createElement('span');counter.dataset.recordingCounter=name;hud.append(dot,feedback,counter);document.body.append(hud);
 function status(){
  const seconds=Math.floor((performance.now()-started)/1000),clock=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  hud.hidden=false;dot.hidden=phase!=='recording';
  feedback.textContent=phase==='recording'?`rec ${clock} · ${clip?.deselected?'deselezionata':clip?.cut?'tagliata':clip?.selected?'selezionata':'s seleziona · d deseleziona · x taglia'}${!audioConfig?' · senza audio':clip?.audioUnavailable?' · audio sorgente non disponibile':''}`:notice;
  counter.hidden=!['recording','saving'].includes(phase);counter.textContent=' · video selezionati: '+selectedCount;
 }
 function message(text){notice=text;status();}
 function error(reason){message('registrazione: '+(reason?.message||reason));if(phase==='recording')void stop();}
 // While capturing, the media element supplies full source audio. Its separate
 // playback gain follows the UI mute state, so it never leaks audible sound.
 function syncAudioMonitor(){
  const c=clip,scene=getScene();if(!c?.tap||c.ended||scene?.key!==c.key)return;
  c.monitorMuted=Boolean(scene.muted);c.tap.gain.gain.value=c.monitorMuted?0:c.monitorVolume;
  c.element.muted=false;c.element.volume=1;
 }
 function prepareAudioMonitor(scene,c){
  const video=scene.video;c.element=video;c.monitorVolume=video.volume;c.monitorMuted=Boolean(scene.muted);
  let tap=playbackTaps.get(video);
  if(!tap){const node=audioContext.createMediaElementSource(video),gain=audioContext.createGain();tap={node,gain,connected:false};playbackTaps.set(video,tap);}
  tap.gain.gain.value=c.monitorMuted?0:c.monitorVolume;
  if(!tap.connected){tap.node.connect(tap.gain);tap.gain.connect(audioContext.destination);tap.connected=true;}
  c.tap=tap;syncAudioMonitor();
 }
 function releaseMedia(video){const tap=playbackTaps.get(video);if(tap){tap.node.disconnect();tap.gain.disconnect();tap.connected=false;}}
 function disconnectInput(c=clip){
  if(!c)return;if(c.tap){c.element.muted=c.monitorMuted;c.element.volume=c.monitorVolume;c.tap.gain.gain.value=1;c.tap=null;}c.reader?.cancel().catch(()=>{});c.reader=null;c.stream?.getTracks().forEach(t=>t.stop());c.stream=null;
 }
 function encodeAudio(c,planar,frames){
  if(c.ae?.state!=='configured')return;
  const data=new AudioData({format:'f32-planar',sampleRate:48000,numberOfFrames:frames,numberOfChannels:2,timestamp:Math.round(c.audioFrames/48000*1e6),data:planar});
  try{c.ae.encode(data);c.audioFrames+=frames;}finally{data.close();}
 }
 function connectInput(scene,c){
  if(!audioConfig)return;
  const get=scene.video?.captureStream||scene.video?.mozCaptureStream;
  if(!get){c.audioUnavailable=true;return;}
  try{
   prepareAudioMonitor(scene,c);
   c.stream=get.call(scene.video);const track=c.stream.getAudioTracks()[0];
   if(!track){c.audioUnavailable=true;return;}
   c.stream.getVideoTracks().forEach(t=>t.stop());c.reader=new MediaStreamTrackProcessor({track}).readable.getReader();
   const reader=c.reader;
   (async()=>{
    while(!c.ended&&!c.cut){
     const {value,done}=await reader.read();if(done)break;
     try{
      if(c.ended||c.cut)break;if(c.pauseStarted)continue;c.audioRunning=true;
      const frames=Math.max(1,Math.round(value.numberOfFrames*48000/value.sampleRate)),planar=new Float32Array(frames*2);
      // Capture the source track independently of the page's mute/volume controls.
      for(let ch=0;ch<2;ch++){
       const input=new Float32Array(value.numberOfFrames);value.copyTo(input,{planeIndex:Math.min(ch,value.numberOfChannels-1),format:'f32-planar'});
       for(let i=0;i<frames;i++){const at=i*value.sampleRate/48000,low=Math.min(input.length-1,Math.floor(at)),high=Math.min(input.length-1,low+1);planar[ch*frames+i]=input[low]+(input[high]-input[low])*(at-low);}
      }
      encodeAudio(c,planar,frames);
     }finally{value.close();}
    }
   })().catch(()=>{if(!c.ended){c.audioRunning=false;c.audioUnavailable=true;}});
  }catch{c.audioUnavailable=true;}
 }
 function begin(scene){
  const c={session:sessionId,key:scene.key,order:serial++,started:performance.now(),selected:selectPending,cut:false,ended:false,video:[],audio:[],audioFrames:0,last:0,frameCount:0};clip=c;if(c.selected)selectedCount++;selectPending=false;

  c.ve=new VideoEncoder({output:(chunk,meta)=>c.video.push({chunk,meta}),error});c.ve.configure(videoConfig);
  if(audioConfig){c.ae=new AudioEncoder({output:(chunk,meta)=>c.audio.push({chunk,meta}),error});c.ae.configure(audioConfig);}
  connectInput(scene,c);return c;
 }
 function finish(c,cut=false){
  if(!c||c.ended)return;c.ended=true;c.cut=cut||c.cut;disconnectInput(c);
  c.duration=Math.max(c.last+40000,Math.ceil(((c.pauseStarted||performance.now())-c.started)*1000/20000)*20000);
  const job=(async()=>{
   try{
    await c.ve.flush();if(c.session!==sessionId)c.selected=false;
    if(c.preview&&c.selected){for(const timestamp of [c.duration-40000,c.duration-20000])if(timestamp>c.last){const frame=new VideoFrame(c.preview,{timestamp,duration:20000});c.ve.encode(frame,{keyFrame:true});frame.close();c.last=timestamp;}await c.ve.flush();}
    if(c.ae&&c.selected)while(c.audioFrames/48000*1e6<c.duration){const frames=Math.min(1024,Math.ceil((c.duration/1e6-c.audioFrames/48000)*48000));if(frames<=0)break;encodeAudio(c,new Float32Array(frames*2),frames);}
    await c.ae?.flush();
    if(c.selected&&c.video.length)clips.push(c);else{c.video.length=0;c.audio.length=0;}}
   finally{c.preview?.close();c.preview=null;if(c.ve.state!=='closed')c.ve.close();if(c.ae&&c.ae.state!=='closed')c.ae.close();}
  })();pending.push(job);job.catch(error);
 }
 function sample(){
  if(phase!=='recording')return;
  try{
   const scene=getScene();
   if(!scene){if(clip){finish(clip);clip=null;}return;}
   if(!clip||clip.key!==scene.key){finish(clip);begin(scene);}
   const c=clip;if(c.cut||c.ended)return;syncAudioMonitor();
   if(scene.paused){c.pauseStarted??=performance.now();return;}
   if(c.pauseStarted){c.started+=performance.now()-c.pauseStarted;c.pauseStarted=null;c.forceKeyFrame=true;}
   if(c.ae&&!c.audioRunning){const gap=Math.floor((performance.now()-c.started)*48)-c.audioFrames;if(gap>=1024)encodeAudio(c,new Float32Array(2048),1024);}
   if(c.ve.encodeQueueSize>48)return;
   if(c.ve.encodeQueueSize>12&&!c.draining){c.draining=true;c.ve.flush().then(()=>{c.draining=false;}).catch(error);c.forceKeyFrame=true;}
   const timestamp=c.frameCount?Math.round((performance.now()-c.started)*1000):0;
   if(c.frameCount&&timestamp-c.last<35000)return;
   const area=frameRectangle();context.save();
   try{context.fillStyle='#000';context.fillRect(0,0,surface.width,surface.height);context.scale(surface.width/area.width,surface.height/area.height);context.translate(-area.x,-area.y);scene.draw(context,innerWidth,innerHeight);}finally{context.restore();}
   const frame=new VideoFrame(surface,{timestamp,duration:40000});
   try{c.ve.encode(frame,{keyFrame:c.forceKeyFrame||c.frameCount%25===0});c.preview?.close();c.preview=frame.clone();c.forceKeyFrame=false;c.last=timestamp;c.frameCount++;}finally{frame.close();}
  }catch(e){error(e);}
 }
 async function start(){
  if(phase!=='idle')return;const token=++sessionId;phase='starting';syncControls();selectedCount=0;selectPending=false;message('preparazione registrazione…');
  try{
   if((!globalThis.VideoEncoder||!globalThis.VideoFrame))throw Error('MP4 non supportato da questo browser: usa Chrome o Edge aggiornato');
   const {width,height}=dimensions,blocks=Math.ceil(width/16)*Math.ceil(height/16),level=blocks<=3600?'1f':blocks<=8192?'28':blocks<=8704?'2a':blocks<=22080?'32':blocks<=36864?'33':'3c';
   videoConfig={codec:'avc1.4200'+level,width,height,bitrate:Math.min(18000000,Math.round(3000000*width*height/(1280*720))),framerate:25,latencyMode:'realtime',avc:{format:'avc'}};
   if(!(await VideoEncoder.isConfigSupported(videoConfig)).supported)throw Error('encoder MP4 H.264 non disponibile');if(token!==sessionId)return;
   audioConfig={codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,bitrate:128000};
   if((!globalThis.AudioEncoder||!globalThis.MediaStreamTrackProcessor||!(await AudioEncoder.isConfigSupported(audioConfig)).supported))throw Error('registrazione MP4 con audio non supportata: usa Chrome o Edge aggiornato');if(token!==sessionId)return;
   {audioContext??=new AudioContext();await audioContext.resume();}if(token!==sessionId)return;
   {surface=document.createElement('canvas');surface.width=width;surface.height=height;context=surface.getContext('2d',{alpha:false});}
   clips=[];pending=[];clip=null;serial=0;saved=0;started=performance.now();phase='recording';sample();timer=setInterval(sample,40);hudTimer=setInterval(status,200);status();
  }catch(e){if(token!==sessionId)return;phase='idle';syncControls();await cleanup();message(e.message);}
 }
 async function cleanup(){
  clearInterval(timer);clearInterval(hudTimer);timer=hudTimer=null;disconnectInput();
  if(surface){surface.width=surface.height=0;surface=context=null;}
 }
 async function stop(){
  if(stopPromise)return stopPromise;if(phase!=='recording')return;const token=sessionId;
  sample();beginExport('live',dimensions.width,dimensions.height,selectedCount);phase='saving';syncControls();finish(clip);clip=null;clearInterval(timer);clearInterval(hudTimer);message('montaggio MP4…');
  stopPromise=(async()=>{
   try{
    await Promise.all(pending);if(token!==sessionId)return;await cleanup();if(token!==sessionId)return;

    const selected=clips.filter(c=>c.selected).sort((a,b)=>a.order-b.order);if(!selected.length){exportProgress('nessuna clip selezionata',{stage:'empty',progress:null});return;}
    const {Muxer,ArrayBufferTarget}=createMP4Muxer(),target=new ArrayBufferTarget();
    const muxer=new Muxer({target,video:{codec:'avc',width:videoConfig.width,height:videoConfig.height},...(audioConfig?{audio:{codec:'aac',sampleRate:48000,numberOfChannels:2}}:{}),fastStart:'in-memory',firstTimestampBehavior:'offset'});
    let offset=0;
    for(const c of selected){
     const first=c.video[0].chunk.timestamp;
     for(let i=0;i<c.video.length;i++){
      const {chunk,meta}=c.video[i],at=chunk.timestamp-first,until=i+1<c.video.length?c.video[i+1].chunk.timestamp-first:c.duration;
      const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);muxer.addVideoChunkRaw(bytes,chunk.type,offset+at,Math.max(1,until-at),meta);
     }
     if(audioConfig)for(const {chunk,meta} of c.audio){const at=Math.max(0,chunk.timestamp);if(at>=c.duration)continue;const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);muxer.addAudioChunkRaw(bytes,chunk.type,offset+at,Math.min(chunk.duration,c.duration-at),meta);}
     offset+=c.duration;
    }
    muxer.finalize();const url=URL.createObjectURL(new Blob([target.buffer],{type:'video/mp4'})),a=document.createElement('a');a.href=url;a.download=name+'_'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);saved=selected.length;exportProgress('completato · download MP4 avviato',{stage:'complete',completed:saved,progress:1});message(saved+' clip · MP4 salvato');
   }catch(e){if(token===sessionId)exportProgress('errore · '+e.message,{stage:'error'});}finally{if(token===sessionId){await cleanup();clips=[];pending=[];phase='idle';syncControls();stopPromise=null;setTimeout(()=>{if(phase==='idle')hud.hidden=true;},5000);}}
  })();return stopPromise;
 }
 async function cancel(){
  if(renderAbort){renderAbort.abort();return exportPromise;}if(cancelPromise)return cancelPromise;if(phase==='idle')return;
  ++sessionId;phase='cancelling';clearInterval(timer);clearInterval(hudTimer);selectPending=false;
  for(const c of clips)c.selected=false;if(clip){clip.selected=false;finish(clip);clip=null;}
  syncControls();message('annullamento registrazione…');
  const saving=stopPromise,jobs=[...pending];if(saving)jobs.push(saving);
  cancelPromise=(async()=>{await Promise.allSettled(jobs);await cleanup();clips=[];pending=[];selectedCount=0;saved=0;stopPromise=null;phase='idle';syncControls();exportProgress('registrazione annullata · nessun file creato',{stage:'cancelled',progress:null});cancelPromise=null;setTimeout(()=>{if(phase==='idle')hud.hidden=true;},5000);})();
  return cancelPromise;
 }
 function select(){if(phase!=='recording')return;sample();if(clip&&!clip.cut&&!clip.ended&&!clip.selected){clip.selected=true;clip.deselected=false;selectedCount++;}status();}
 function deselect(){
  if(phase==='starting'){selectPending=false;return;}
  if(phase!=='recording')return;sample();
  if(clip?.selected){clip.selected=false;clip.deselected=true;selectedCount=Math.max(0,selectedCount-1);clips=clips.filter(c=>c!==clip);if(clip.ended){clip.video.length=0;clip.audio.length=0;}}
  status();
 }
 function cut(){if(phase!=='recording'||!clip?.selected||clip.cut)return;sample();clip.cut=true;finish(clip,true);disconnectInput();status();}
 async function exportScreens(withIntro=false,source=getSnapshots,label=''){
  if(exportPromise)return exportPromise;
  exportPromise=(async()=>{
   if(phase==='recording')await stop();else if(phase==='saving'&&stopPromise)await stopPromise;if(phase!=='idle')return;
   renderAbort=new AbortController();const signal=renderAbort.signal;phase='rendering';beginExport('screens',dimensions.width,dimensions.height);syncControls();const resume=suspendPlayback();
   try{
    exportProgress('preparazione screen MP4…',{stage:'preparation'});
    const items=await source();if(!items.length)throw Error('nessun video visto da esportare');
    const options={...dimensions,frame:frameRectangle(),signal,onProgress:exportProgress},intro=withIntro&&getScreenIntro?await getScreenIntro(options):null;
    const blob=intro?await intro.render([...intro.items,...items],options):await renderScreenReel(items,options);
    signal.throwIfAborted();saveRecordingFile(blob,name+(label||(intro?'-intro':'-screens'))+'.mp4');exportProgress('completato · download MP4 avviato',{stage:'complete',completed:exportState.total,progress:1});message('MP4 salvato');
   }catch(error){exportProgress(signal.aborted?'elaborazione annullata · nessun video creato':'errore · '+error.message,{stage:signal.aborted?'cancelled':'error'});}
   finally{clearInterval(exportTimer);exportTimer=null;renderAbort=null;phase='idle';syncControls();resume?.();setTimeout(()=>{if(phase==='idle')hud.hidden=true;},5000);}
  })().finally(()=>{exportPromise=null;});return exportPromise;
 }
 document.addEventListener('keydown',event=>{
  if(event.repeat||event.metaKey||event.ctrlKey||event.altKey||event.target.closest?.('input:not([type="checkbox"]),textarea,select,[contenteditable="true"]'))return;
  const key=event.key.toLowerCase();if(key==='g'||key==='v'&&getScreenIntro){event.preventDefault();event.stopImmediatePropagation();void exportScreens(key==='v');return;}if(key==='arrowright'&&phase==='recording'){cut();return;}if(key==='arrowright'&&phase==='starting'){selectPending=false;return;}if(key!=='r'&&!(phase!=='idle'&&['s','d','x','q'].includes(key)))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(key==='r'){if(phase==='idle')void start();else if(phase==='recording')void stop();}else if(key==='s'){if(phase==='starting')selectPending=true;else select();}else if(key==='d')deselect();else if(key==='q')void cancel();else cut();
 },true);
 return {start,stop,cancel,exportScreens,select,deselect,cut,sample,controlsHTML,syncAudioMonitor,releaseMedia,get status(){return {phase,selected:selectedCount,width:dimensions.width,height:dimensions.height,frame:frameRectangle(),cut:!!clip?.cut,frames:clip?.frameCount||0,audioFrames:clip?.audioFrames||0,queued:clip?.ve?.encodeQueueSize||0,saved,notice,export:{...exportState}};}};
}
