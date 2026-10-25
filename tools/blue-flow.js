(() => {
'use strict';
const stills=document.body.dataset.project==='stills',wiki=stills&&document.body.dataset.wiki==='1';
// ?reset (any value): forget everything this browser saved for Blueness, i.e.
// shown videos, C settings, candidates, recording size; then drop the parameter.
try{const url=new URL(location.href);if(url.searchParams.has('reset')){for(const store of [localStorage,sessionStorage])for(const key of Object.keys(store))if(/^blue|recording/i.test(key))store.removeItem(key);url.searchParams.delete('reset');window.history.replaceState(null,'',url);}}catch{}
const baseStills=stills&&!wiki;
const mode=document.body.dataset.mode,archiveMode=mode==='archive',mixed=mode==='mixed';
const iosVideo=!stills&&typeof createBluenessIOSVideo==='function'?createBluenessIOSVideo():null;
const introEnabled=baseStills||(mode==='video'&&typeof BLUENESS_STARTUP!=='undefined');
let sources=document.body.dataset.sources||'both';
if(stills){const source=new URL(location.href).searchParams.get('source');if(['archive','commons','both'].includes(source))sources=source;}
const preferencesKey='blue-controls-v3-'+(stills?(wiki?'stills-wiki':'stills'):mode);
const kinds=mode==='video'?['video']:mixed?['image','video']:['image'];
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d',{alpha:false});
const analysis=document.createElement('canvas'),ac=analysis.getContext('2d',{willReadFrequently:true});
const controls=document.querySelector('#controls'),info=document.querySelector('#info');
if(iosVideo){controls.style.zIndex='26';info.style.zIndex='26';}
// The CLICK EVERYWHERE tap also turns the sound on (same gesture as play()).
if(iosVideo)iosVideo.onGesture=media=>{muted=false;media.muted=false;};
const defaults={size:50,hue:25,violet:12,saturation:55,brightness:45,redMax:40,greenMax:65,rgbDistance:210,disturbance:20,zoom:1,minZoom:.5,maxZoom:8,fps:4,quality:stills?(wiki?120:160):640,seconds:mode==='mixed'?4:15,hz:8,dual:false,showBorder:false,motionStep:18,trackingTolerance:15,cameraCooldown:1.2};
const settings={...defaults};try{Object.assign(settings,JSON.parse(localStorage.getItem(preferencesKey)||'{}'));}catch{}
if(settings.motionStep===10)settings.motionStep=18;
// Old saved thematic preferences must not restore removed content filters.
delete settings.excludeGovernment;delete settings.excludePolitics;
const initialURL=new URL(location.href);settings.dual=initialURL.searchParams.get('dual')==='1';
function syncURL(){try{const url=new URL(location.href);if(settings.dual)url.searchParams.set('dual','1');else url.searchParams.delete('dual');if(stills){if(sources!==document.body.dataset.sources)url.searchParams.set('source',sources);else url.searchParams.delete('source');}window.history.replaceState(null,'',url);}catch{}}
// window.history is used explicitly because the media history below has the same name.
const pools=Object.fromEntries(kinds.map(kind=>[kind,{urls:[],list:[],listLoading:0,ready:[],loading:0,fetching:false,next:0,checked:0,accepted:0,discarded:0,lastError:'',loaded:0,loadMs:0,analysisMs:0,timeouts:0,failures:0,seen:new Set()}]));
// Define search inputs before constructing controls or decoding the intro.
const imageExcludedWords=['trump','maga','campaign','campaigns','campaigning','campign','politic','politics','political','republican','republicans','democrat','democrats','election','elections','electoral','president','presidents','presidential','"white house"','biden','harris','gop',...(baseStills?['"capitol attack"','"capitol hill"']:[])];
const imageGeographyWords=['usa','"united states"','"u.s."','"u.s.a."','"US"'];
const archiveImageExclusions=' AND NOT ('+imageExcludedWords.join(' OR ')+' OR '+imageGeographyWords.flatMap(term=>['title','subject','creator'].map(field=>field+':'+term)).join(' OR ')+' OR identifier:usgov*)'+(baseStills?' AND NOT subject:"January 6 Capitol Attack"':'');
const commonsImageExclusions=imageExcludedWords.map(word=>'-'+word).concat(imageGeographyWords.map(word=>'-intitle:'+word),['-incategory:"Politics of the United States"','-incategory:"United States"']).join(' ');
const totals=new Map(),searchTurns=new Map();
const VIDEO_QUEUE_LIMIT=iosVideo?2:6,IMAGE_QUEUE_LIMIT=stills?12:36,introEndsAt=performance.now()+4000,startedAt=performance.now(),burstMinAt=performance.now()+1000;let playbackPaused=false,pausedAt=0;
let revision=0,current=null,history=[],historyIndex=-1,shownAt=0,lastDetect=0,lostAt=0,lastError='',checked=0,accepted=0,shown=0,infoVisible=false,squareWindow=null,muted=true,lastInfo=0,lastPaintKey='',reviewing=false,mixedNeedsImage=false;
const startupTiming={searchAt:null,resultsAt:null,loadedAt:null,readyAt:null,paintedAt:null};
// Launch discovery even before reading the accumulated playback history.
if(baseStills)fetchBatch('image');
// Shared persistent history across all blue variants; never rotate or trim it.
const playedKey='blue-played-v1',played=new Set();
function mediaKey(item){try{return decodeURIComponent(new URL(item.source).hostname+new URL(item.source).pathname).replace(/_/g,' ').normalize('NFC');}catch{return item.source;}}
function mergePlayed(value){try{for(const key of JSON.parse(value||'[]'))played.add(key);}catch{}}
const stillsPlayedPrefix='blueness-seen-v2:';
try{mergePlayed(localStorage.getItem(playedKey));if(baseStills)for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(stillsPlayedPrefix))played.add(key.slice(stillsPlayedPrefix.length));}}catch{}
addEventListener('storage',event=>{if(event.key===playedKey)mergePlayed(event.newValue);if(baseStills&&event.key?.startsWith(stillsPlayedPrefix)&&event.newValue)played.add(event.key.slice(stillsPlayedPrefix.length));});
function rememberPlayed(item){
 played.add(mediaKey(item));if(baseStills&&item.fingerprint)played.add(item.fingerprint);
 try{if(baseStills){localStorage.setItem(stillsPlayedPrefix+mediaKey(item),'1');if(item.fingerprint)localStorage.setItem(stillsPlayedPrefix+item.fingerprint,'1');}else{mergePlayed(localStorage.getItem(playedKey));localStorage.setItem(playedKey,JSON.stringify([...played]));}}
 catch{lastError='cronologia non salvabile: anti-ripetizione attiva solo in questa sessione';}
}
// Keep unused, previously verified candidates as a fast starting pool, never replay shown media.
const blueCatalog=new Map(),contentSeen=new Set();let catalogTimer,previewShown=0,introFrame=null,introEnded=false,firstLiveAt=0;const introSequence=[];
function imageFingerprint(media){
 const c=imageFingerprint.canvas||(imageFingerprint.canvas=document.createElement('canvas'));c.width=c.height=24;
 const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(media,0,0,24,24);
 const pixels=context.getImageData(0,0,24,24).data;let a=2166136261,b=5381;
 for(let i=0;i<pixels.length;i++){a=Math.imul(a^pixels[i],16777619);b=Math.imul(b,33)^pixels[i];}
 return 'pixels-v1:'+ (a>>>0).toString(16)+':'+(b>>>0).toString(16);
}
if(typeof BLUENESS_CATALOG!=='undefined')for(const item of BLUENESS_CATALOG)if(item.verified&&item.kind===(stills?'image':'video'))blueCatalog.set(mediaKey(item),item);
try{if(!stills)for(const item of JSON.parse(localStorage.getItem('blue-candidates-v1')||'[]'))if(item.source&&item.kind&&item.candidatePolicy==='general-or-color-tag-v1')blueCatalog.set(mediaKey(item),item);}catch{}
function recordCandidate(entry){
 if(stills&&!baseStills)return;
 const item={candidatePolicy:'general-or-color-tag-v1',provider:entry.provider,id:entry.id,url:baseStills?entry.url:iosVideo?entry.remoteURL||entry.url:entry.media.currentSrc||entry.url,title:entry.title,source:entry.source,author:entry.author,license:entry.license,kind:entry.kind,filename:entry.filename,startTime:entry.startTime,verified:true,fingerprint:entry.fingerprint,videoVariants:entry.videoVariants};
 blueCatalog.set(mediaKey(item),item);while(blueCatalog.size>1000)blueCatalog.delete(blueCatalog.keys().next().value);
 if(baseStills)return;
 clearTimeout(catalogTimer);catalogTimer=setTimeout(()=>{try{localStorage.setItem('blue-candidates-v1',JSON.stringify([...blueCatalog.values()]));}catch{}},400);
}
function seedCandidates(limit=20,priority=false){
 // The pre-verified list is a standby, not the queue: live search always runs
 // and a ready live video always wins (see pump/advance).
 let added=0;if(stills)return;const shuffled=[...blueCatalog.values()];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}for(const item of shuffled){const pool=pools[item.kind];if(!pool||played.has(mediaKey(item))||pool.seen.has(item.source)||(sources!=='both'&&item.provider!==sources))continue;pool.seen.add(item.source);pool.list.push({...item,fromList:true});}}
const recording=createSelectiveRecorder({name:'bluenessmovements',getScreenIntro:!stills&&introEnabled?async({signal,frame})=>({items:await buildBluenessIntroRecords({startup:BLUENESS_STARTUP,svg:BLUENESS_INTRO_SVG,sequence:introSequence.slice(),endAt:firstLiveAt||performance.now(),scene:{width:canvas.width,height:canvas.height,size:settings.size,screens:screens()}},{signal}),render:(items,options)=>renderBluenessIntroReel(items.map(item=>({...item,frame:item.frame||frame})),{...options,frameSeconds:1/8,svgText:BLUENESS_INTRO_SVG})}):null,suspendPlayback:()=>{const was=playbackPaused;if(!was)togglePlaybackPause();return()=>{if(!was&&playbackPaused)togglePlaybackPause();};},getSnapshots:async()=>route.slice().map(r=>{const dualView=settings.dual,w=dualView?r.w:r.singleW,h=dualView?r.h:r.singleH,scale=Math.min(innerWidth/w,innerHeight/h);return {blob:dualView?r.scene:r.single,layout:{layers:[{source:{x:0,y:0,width:1,height:1},destination:{x:(innerWidth-w*scale)/2,y:(innerHeight-h*scale)/2,width:w*scale,height:h*scale}}]}};}),getScene:()=>{
 if(!current||current.kind!=='video'||!current.match)return null;
 return {key:shown,video:current.media,muted,paused:playbackPaused||document.hidden||current.media.paused||current.media.readyState<3,draw:(target,w,h)=>{
  target.fillStyle='#000';target.fillRect(0,0,w,h);for(const screen of screens())drawScreen(target,screen,screen.square);
 }};
}});

const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const searchStatus=document.createElement('p');searchStatus.setAttribute('aria-live','polite');searchStatus.className='search-status';controls.append(searchStatus);
const fields=document.createElement('div');fields.className='control-fields';controls.append(fields);fields.insertAdjacentHTML('beforeend',recording.controlsHTML());
const stillsExporter=stills?createStillsExporter({name:wiki?'blueness-wiki':'blueness-image',container:fields,getIntro:baseStills?()=>({startup:BLUENESS_STARTUP,svg:BLUENESS_INTRO_SVG,sequence:introSequence.slice(),endAt:firstLiveAt||performance.now(),scene:{width:canvas.width,height:canvas.height,size:settings.size,screens:screens()}}):null,getScene:()=>({entry:current,screens:screens(),width:canvas.width,height:canvas.height,size:settings.size,dual:settings.dual,showBorder:settings.showBorder,introOverlay:baseStills&&current?.hideIntroBorder&&!!document.getElementById('blueness-intro'),second:!!(squareWindow&&!squareWindow.closed)}),isPaused:()=>playbackPaused,pause:()=>{if(!playbackPaused)togglePlaybackPause();},resume:()=>{if(playbackPaused)togglePlaybackPause();}}):null;
if(baseStills){const button=document.createElement('button');button.textContent='scarica raccolta verificata JSON';button.className='export-button';button.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify([...blueCatalog.values()],null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='blueness-images.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};fields.append(button);}
const actions=document.createElement('div');actions.className='actions';fields.append(actions);
const sourceLink=document.createElement('a');sourceLink.target='_blank';sourceLink.rel='noopener';sourceLink.textContent='fonte';fields.append(sourceLink);
const groups={};function controlGroup(name,open=false){if(!groups[name]){const details=document.createElement('details'),title=document.createElement('summary');title.textContent=name;details.open=open;details.append(title);fields.append(details);groups[name]=details;}return groups[name];}
const ranges=[['size','lato quadrato fisso sullo schermo · px',10,180,1],['hue','ampiezza del blu · ± gradi di tonalità',1,80,1],['violet','lato viola · massimo gradi oltre il blu',0,80,1],['saturation','saturazione minima · %',0,100,1],['brightness','luminosità minima · %',0,100,1],['redMax','rosso massimo rispetto al blu · % (meno viola)',0,100,1],['greenMax','verde massimo rispetto al blu · % (meno ciano)',0,100,1],['rgbDistance','distanza RGB da #0000ff · 0 = esatto',0,442,1],['disturbance','pixel fuori range ammessi · %',0,70,1],['minZoom','zoom automatico minimo · ×',.25,1,.25],['maxZoom','zoom automatico massimo · ×',1,12,.5],...(kinds.includes('video')?[['motionStep','spostamento minimo inquadratura · px',0,80,1],['trackingTolerance','tolleranza extra durante il tracking · %',0,40,1],['cameraCooldown','pausa minima fra correzioni · secondi',.3,3,.1]]:[]),...(kinds.includes('image')?[['fps','immagini al secondo',.5,10,.5],['quality','qualità immagini · lato richiesto in px',wiki?120:160,1280,wiki?10:160]]:[]),...(kinds.includes('video')?[['seconds','tempo massimo fra cambi video · secondi',.1,mixed?4:30,.1],['hz','analisi video · frame al secondo',2,15,1]]:[])];
const swatch=document.createElement('div');
function save(){try{localStorage.setItem(preferencesKey,JSON.stringify(settings));}catch{}}
function invalidate(key){
 if(['size','hue','violet','saturation','brightness','disturbance','quality','redMax','greenMax','rgbDistance','minZoom','maxZoom','sources'].includes(key)){
  revision++;for(const pool of Object.values(pools)){pool.ready.splice(0).forEach(release);if(['quality','sources'].includes(key))pool.urls.length=0;}
  if(current){current.match=null;current.cameraAnchor=null;current.pendingCamera=null;lastDetect=0;}
 }
 if(key==='dual'||stills&&key==='sources')syncURL();if(key==='sources')seedCandidates();save();updateSwatch();lastPaintKey='';alignIntro();pump();
}
for(const [key,label,min,max,step] of ranges){
 settings[key]=Math.max(min,Math.min(max,(Number.isFinite(Number(settings[key]))?Number(settings[key]):defaults[key])));
 const row=document.createElement('label'),caption=document.createElement('span'),output=document.createElement('output'),input=document.createElement('input');caption.textContent=label;input.type='range';input.setAttribute('aria-label',label);Object.assign(input,{min,max,step,value:settings[key]});output.textContent=input.value;
 input.addEventListener('input',()=>{output.textContent=input.value;});
 input.addEventListener('change',()=>{const value=Number(input.value);if(input.value===''||!Number.isFinite(value)){input.value=settings[key];return;}const next=Math.max(min,Math.min(max,value));input.value=next;if(next===settings[key])return;settings[key]=next;output.textContent=input.value;invalidate(key);});row.append(caption,output,input);const group=['hue','saturation','brightness','redMax','greenMax','rgbDistance','disturbance'].includes(key)?'colore':['size','minZoom','maxZoom','motionStep','trackingTolerance','cameraCooldown'].includes(key)?'inquadratura':'riproduzione';controlGroup(group).append(row);
}
function updateSwatch(){swatch.style.background=`linear-gradient(90deg,hsl(${240-settings.hue} 100% 50%),#0000ff,hsl(${240+Math.min(settings.hue,settings.violet??settings.hue)} 100% 50%))`;swatch.title='intervallo di tonalità accettato';}updateSwatch();
const sourceSelect=document.createElement('select');for(const [value,label]of [['both','commons + internet archive'],['commons','solo wikimedia commons'],['archive','solo internet archive']]){const option=document.createElement('option');option.value=value;option.textContent=label;sourceSelect.append(option);}sourceSelect.value=sources;sourceSelect.onchange=()=>{sources=sourceSelect.value;invalidate('sources');};const sourceRow=document.createElement('label');sourceRow.append(sourceSelect);controlGroup('archivi').append(sourceRow);
for(const [key,label]of [['showBorder','mostra bordo']]){const row=document.createElement('label'),input=document.createElement('button');input.dataset.setting=key;input.textContent=settings[key]?'1':'0';input.onclick=()=>{settings[key]=!settings[key];input.textContent=settings[key]?'1':'0';invalidate(key);};row.append(label,input);controlGroup('schermi').append(row);}
syncURL();
const dualLabel=document.createElement('label'),dual=document.createElement('button');dual.textContent=settings.dual?'1':'0';dual.onclick=()=>{settings.dual=squareWindow&&!squareWindow.closed?false:!settings.dual;dual.textContent=settings.dual?'1':'0';invalidate('dual');};dualLabel.append('simula due schermi 16:9',dual);controlGroup('schermi').append(dualLabel);
const second=document.createElement('button');second.textContent='apri secondo schermo';second.className='screen-button';second.onclick=()=>{
 squareWindow=window.open('about:blank','blue-square','popup,width=960,height=540');if(!squareWindow)return;settings.dual=false;settings.showBorder=false;dual.textContent='0';const borderToggle=fields.querySelector('[data-setting=showBorder]');if(borderToggle)borderToggle.textContent='0';invalidate('dual');
 squareWindow.document.write('<!doctype html><title>Blueness</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27%3E%3Cpath fill=%27blue%27 d=%27M0 0h16v16H0z%27/%3E%3C/svg%3E"><style>html,body{margin:0;background:black;overflow:hidden}canvas{display:block}</style><canvas></canvas>');squareWindow.document.close();lastPaintKey='';
};
const nav=document.createElement('div');nav.className='navigation';for(const [label,action]of [['◀',back],['▶',()=>advance(true)]]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',label==='◀'?'indietro':'avanti');b.onclick=action;nav.append(b);}actions.append(nav,second);
const route=[],routeSeen=new Set();let exportingPDF=false;
const exportButton=document.createElement('button');exportButton.textContent='elabora e scarica PDF';exportButton.className='export-button';exportButton.onclick=exportRoute;fields.append(exportButton);exportButton.hidden=stills;
function jpeg(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>{canvas.width=canvas.height=0;blob?resolve(blob):reject(Error('fotogramma non disponibile'));},'image/jpeg',quality));}
function captureRoute(entry){
 if(entry.kind!=='video'||routeSeen.has(mediaKey(entry))||!entry.match)return;
 routeSeen.add(mediaKey(entry));
 const w=Math.max(1,Math.min(canvas.width/2,canvas.height*16/9)),h=w*9/16,scale=Math.min(1,1200/(w*2));
 const scene=document.createElement('canvas');scene.width=Math.round(w*2*scale);scene.height=Math.round(h*scale);const sc=scene.getContext('2d');sc.fillStyle='#000';sc.fillRect(0,0,scene.width,scene.height);sc.scale(scale,scale);
 drawScreen(sc,{x:0,y:0,w,h},false,entry,false,true);drawScreen(sc,{x:w,y:0,w,h},true,entry,false,true);
 const tile=document.createElement('canvas');tile.width=tile.height=64;const tc=tile.getContext('2d');tc.fillStyle='#000';tc.fillRect(0,0,64,64);tc.scale(64/settings.size,64/settings.size);drawScreen(tc,{x:0,y:0,w:settings.size,h:settings.size},true,entry,false,true);
 const single=document.createElement('canvas'),singleScale=Math.min(1,1200/canvas.width);
 single.width=Math.max(1,Math.round(canvas.width*singleScale));single.height=Math.max(1,Math.round(canvas.height*singleScale));
 const singleContext=single.getContext('2d');singleContext.fillStyle='#000';singleContext.fillRect(0,0,single.width,single.height);singleContext.scale(singleScale,singleScale);
 drawScreen(singleContext,{x:0,y:0,w:canvas.width,h:canvas.height},false,entry,false,true);
 singleContext.lineWidth=1;singleContext.strokeStyle='#fff';singleContext.strokeRect(Math.round(canvas.width/2-settings.size/2)+.5,Math.round(canvas.height/2-settings.size/2)+.5,Math.round(settings.size),Math.round(settings.size));
 const record={source:entry.source,w:scene.width,h:scene.height,scene:jpeg(scene,.65),singleW:single.width,singleH:single.height,single:jpeg(single,.65),tile:jpeg(tile,.8)};
 // One small compressed snapshot per video; PDF assembly and mosaic wait for P/click.
 record.single.catch(()=>{});record.scene.catch(()=>{});record.tile.catch(()=>{});route.push(record);
}
async function exportRoute(){
 if(exportingPDF)return;if(!route.length){exportButton.textContent='nessun video da esportare';return;}
 exportingPDF=true;exportButton.textContent='elaborazione PDF';
 try{
  const records=route.slice(),pages=[],dualView=settings.dual;
  for(const record of records)pages.push({blob:await (dualView?record.scene:record.single),w:dualView?record.w:record.singleW,h:dualView?record.h:record.singleH,source:record.source});
  const cols=Math.min(records.length,Math.ceil(Math.sqrt(records.length*16/9))),rows=Math.ceil(records.length/cols),cell=Math.max(1,Math.min(64,Math.floor(1600/cols)));
  const mosaic=document.createElement('canvas');mosaic.width=cols*cell;mosaic.height=rows*cell;const mc=mosaic.getContext('2d');mc.fillStyle='#000';mc.fillRect(0,0,mosaic.width,mosaic.height);
  for(let i=0;i<records.length;i++){const bitmap=await createImageBitmap(await records[i].tile);mc.drawImage(bitmap,(i%cols)*cell,Math.floor(i/cols)*cell,cell,cell);bitmap.close();}
  const mw=mosaic.width,mh=mosaic.height;pages.push({blob:await jpeg(mosaic,.85),w:mw,h:mh});
  if(dualView)for(const page of pages)page.aspectRatio=16/9;
  const blob=await buildBluenessPDF(pages),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='bluenessmovements-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){lastError=error.message;}finally{exportingPDF=false;exportButton.textContent='elabora e scarica PDF';}
}
let exportingJPEG=false;
async function exportJPEG(){
 if(exportingJPEG||!route.length)return;exportingJPEG=true;
 try{
  const records=route.slice(),dualView=settings.dual,folder='bluenessmovements-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'),parts=[],central=[];let offset=0,centralSize=0;
  // Store JPEGs directly in ZIP: no recompression or additional dependency.
  const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  for(let i=0;i<records.length;i++){
   const data=new Uint8Array(await(await(dualView?records[i].scene:records[i].single)).arrayBuffer()),name=new TextEncoder().encode(folder+'/'+String(i+1).padStart(4,'0')+'.jpg');
   let crc=0xffffffff;for(const byte of data)crc=table[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
   const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
   const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);
   parts.push(header,data);central.push(directory);offset+=header.length+data.length;centralSize+=directory.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,records.length,true);e.setUint16(10,records.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  const url=URL.createObjectURL(new Blob([...parts,...central,end],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=folder+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){lastError=error.message;}finally{exportingJPEG=false;}
}
const credit=document.createElement('footer');credit.append(stills?(wiki?'Blueness wiki, 2026 ':'Blueness image, 2026 '):'Blueness, 2026 ');
for(const [label,url]of [['Enrico Isidori','https://enricoisidori.com'],['Contento360','https://contento360.it']]){if(label==='Contento360')credit.append(' x ');const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener';credit.append(link);}fields.append(credit);
function resize(){canvas.width=innerWidth;canvas.height=innerHeight;lastPaintKey='';alignIntro();}addEventListener('resize',resize);resize();
function release(item){if(!item)return;if(item.kind==='video')recording.releaseMedia(item.media);if(item.poster){item.poster.width=item.poster.height=0;item.poster=null;}if(item.kind==='video'){item.media.pause();item.media.removeAttribute('src');item.media.load();iosVideo?.release(item.media);}else item.media.src='';}
const roiCanvas=document.createElement('canvas'),roiContext=roiCanvas.getContext('2d',{willReadFrequently:true});
const integralSums=new Uint32Array(641*641);
const analysisStats={roi:0,full:0};
function resetBlueAnalysis(){
 // clearRect does not remove a canvas's origin-tainted state. Resizing does.
 analysis.width=analysis.width;roiCanvas.width=roiCanvas.width;
}
function colorTest(){
 const red=settings.redMax/100,green=settings.greenMax/100,sat=settings.saturation/100,value=settings.brightness*2.55,hue=settings.hue,violet=Math.min(hue,settings.violet??hue),limit=settings.rgbDistance*settings.rgbDistance;
 // R/G limits already make B the largest channel; compare HSV algebraically, no divisions.
 // Hue is 240+60(r-g)/delta: r>g leans violet, g>r leans cyan. The violet side is narrower.
 return (p,i)=>{const r=p[i],g=p[i+1],b=p[i+2];if(p[i+3]<=240||b<value||r>b*red||g>b*green)return false;const delta=b-Math.min(r,g),d=255-b;return delta>0&&delta>=sat*b&&60*(r-g)<=violet*delta&&60*(g-r)<=hue*delta&&r*r+g*g+d*d<=limit;};
}
function detect(media,previous){
 const sw=media.videoWidth||media.naturalWidth,sh=media.videoHeight||media.naturalHeight;if(!sw||!sh)return null;
 const scale=Math.min(1,(stills?Math.min(640,settings.quality):640)/Math.max(sw,sh)),w=Math.round(sw*scale),h=Math.round(sh*scale);
 const blue=colorTest(),required=1-settings.disturbance/100;
 // Most video frames need only the already locked square, not a full-frame scan.
 if(previous&&previous.w===w&&previous.h===h&&previous.side){
  const s=previous.side,x=Math.round(previous.x-s/2),y=Math.round(previous.y-s/2);
  if(x>=0&&y>=0&&x+s<=w&&y+s<=h){
   if(roiCanvas.width!==s||roiCanvas.height!==s){roiCanvas.width=roiCanvas.height=s;}
   roiContext.clearRect(0,0,s,s);roiContext.drawImage(media,x*sw/w,y*sh/h,s*sw/w,s*sh/h,0,0,s,s);
   const pixels=roiContext.getImageData(0,0,s,s).data;let hits=0;
   for(let i=0;i<pixels.length;i+=4)if(blue(pixels,i))hits++;
   analysisStats.roi++;
   if(hits/(s*s)+1e-9>=Math.max(.3,required-settings.trackingTolerance/100))return {...previous,ratio:hits/(s*s)};
  }
 }
 if(analysis.width!==w||analysis.height!==h){analysis.width=w;analysis.height=h;}
 ac.clearRect(0,0,w,h);ac.drawImage(media,0,0,w,h);
 const pixels=ac.getImageData(0,0,w,h).data,stride=w+1,sums=integralSums;analysisStats.full++;sums.fill(0,0,stride);
 for(let y=0;y<h;y++){let row=0;sums[(y+1)*stride]=0;for(let x=0;x<w;x++){
  if(blue(pixels,(y*w+x)*4))row++;
  sums[(y+1)*stride+x+1]=sums[y*stride+x+1]+row;
 }}
 // Reuse one integral image at multiple scales; the output aperture never changes size.
 const zooms=[previous?.zoom,settings.minZoom,.25,.5,.75,1,1.5,2,3,4,6,8,12,settings.maxZoom].filter(z=>z>=settings.minZoom&&z<=settings.maxZoom);
 const sides=[...new Set(zooms.map(z=>Math.max(2,Math.ceil(settings.size/settings.maxZoom),Math.min(Math.floor(settings.size/settings.minZoom),Math.round(settings.size/z)))))];
 for(const s of sides){
  if(s>w||s>h||sums[h*stride+w]<required*s*s)continue;
  let best=null,bestScore=-Infinity;
  // Dense scan at small scales; bounded grid for larger areas keeps video tracking light.
  const step=Math.max(1,Math.floor(s/16));
  for(let y=0;y<=h-s;y+=step)for(let x=0;x<=w-s;x+=step){
   const hits=sums[(y+s)*stride+x+s]-sums[y*stride+x+s]-sums[(y+s)*stride+x]+sums[y*stride+x],ratio=hits/(s*s);if(ratio+1e-9<required)continue;
   if(stills&&!previous)return {x:x+s/2,y:y+s/2,w,h,ratio,side:s,zoom:settings.size/s};
   const movement=previous?Math.hypot(x+s/2-previous.x,y+s/2-previous.y)*settings.size/s:Infinity;const zoomChange=previous?.zoom?Math.abs((settings.size/s)/previous.zoom-1):0;if(previous&&movement<settings.motionStep&&zoomChange<.15)continue;
   const distance=previous?Math.hypot(x+s/2-previous.x,y+s/2-previous.y)/Math.max(w,h):0,score=ratio-distance*.18;
   if(score>bestScore){bestScore=score;best={x:x+s/2,y:y+s/2,w,h,ratio,side:s,zoom:settings.size/s};}
  }
  if(best)return best;
 }return null;
}
// Hysteresis in space, color and time: never chase every sampled frame.
function stabilizeCamera(entry,candidate,now){
 const anchor=entry.cameraAnchor;
 if(!anchor||entry.kind!=='video'){entry.lastGoodCamera=now;return candidate;}
 if(candidate&&candidate.x===anchor.x&&candidate.y===anchor.y&&candidate.zoom===anchor.zoom){entry.pendingCamera=null;entry.lastGoodCamera=now;return candidate;}
 if(candidate){
  const pending=entry.pendingCamera;
  const consistent=pending&&Math.hypot(candidate.x-pending.match.x,candidate.y-pending.match.y)*candidate.zoom<=8&&Math.abs(candidate.zoom/pending.match.zoom-1)<.1;
  entry.pendingCamera={match:candidate,count:consistent?pending.count+1:1};
  if(entry.pendingCamera.count>=3&&now-(entry.lastCameraMove||shownAt)>=settings.cameraCooldown*1000){entry.pendingCamera=null;entry.lastCameraMove=now;entry.lastGoodCamera=now;return candidate;}
 }else entry.pendingCamera=null;
 // Brief occlusion/color changes should not flash the loading square.
 return now-(entry.lastGoodCamera||shownAt)<900?anchor:null;
}
function waitEvent(media,event,timeout=10000){return new Promise((resolve,reject)=>{let timer;const done=error=>{clearTimeout(timer);media.removeEventListener(event,ok);media.removeEventListener('error',bad);error?reject(error):resolve();};const ok=()=>done(),bad=()=>done(Error('media non disponibile'));media.addEventListener(event,ok,{once:true});media.addEventListener('error',bad,{once:true});timer=setTimeout(()=>done(Error('caricamento scaduto')),timeout);});}
async function api(params){const response=await fetch('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',origin:'*',...params}),{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Commons HTTP '+response.status);const data=await response.json();if(data.error)throw Error(data.error.info);return Object.values(data.query?.pages||{});}
function colorFallback(key,kind){if(kind==='video')return !!iosVideo&&!current;const n=searchTurns.get(key)||0;searchTurns.set(key,n+1);return (baseStills&&!current&&n===0||n%4===(stills?1:3))&&pools[kind].ready.length<1;}

async function fetchArchive(kind){
 const preferred=colorFallback('archive:'+kind,kind);if(stills&&preferred)pools[kind].colorBatches=(pools[kind].colorBatches||0)+1;
 if(baseStills&&startupTiming.searchAt===null)startupTiming.searchAt=performance.now();
 const base='mediatype:'+(kind==='video'?'movies':'image')+' AND NOT access-restricted-item:true'+(stills?archiveImageExclusions:'')+(kind==='video'?' AND NOT subject:"Capitol Hill" AND NOT subject:"January 6 Capitol Attack"':'');
 const rows=kind==='video'?12:50;let q,page=1;
 if(kind==='video'){
  // Archive only pages through 10,000 results of a query. A random identifier
  // prefix, lengthened until its bucket fits, makes every item reachable, and
  // the page is random from the very first search (count first when unknown).
  const alphabet='abcdefghijklmnopqrstuvwxyz0123456789',letter=()=>alphabet[Math.floor(Math.random()*alphabet.length)];
  const count=async query=>{if(!totals.has(query)){const data=await archiveJSON('https://archive.org/advancedsearch.php?'+new URLSearchParams({q:query,rows:'0',output:'json'}),AbortSignal.timeout(14000));totals.set(query,Number(data.response?.numFound)||0);}return totals.get(query);};
  let prefix=letter()+letter();q=base+(preferred?' AND subject:blue':' AND identifier:'+prefix+'*');let total=await count(q);
  while(!preferred&&total>10000&&prefix.length<4){prefix+=letter();q=base+' AND identifier:'+prefix+'*';total=await count(q);}
  if(!total)return [];
  page=1+Math.floor(Math.random()*Math.ceil(Math.min(total,10000)/rows));
 }else{
  const alphabet='abcdefghijklmnopqrstuvwxyz0123456789',prefix=alphabet[Math.floor(Math.random()*alphabet.length)];
  q=base+(preferred?' AND subject:blue':' AND identifier:'+prefix+'*');const total=totals.get(q);
  page=total?1+Math.floor(Math.random()*Math.ceil(Math.min(total,10000)/rows)):1;
 }
 const params=new URLSearchParams({q,rows:String(rows),page:String(page),output:'json','fl[]':'identifier','sort[]':Math.random()<.5?'identifier asc':'identifier desc'});
 const data=await archiveJSON('https://archive.org/advancedsearch.php?'+params,AbortSignal.timeout(14000));totals.set(q,Number(data.response?.numFound)||0);
 if(baseStills&&startupTiming.resultsAt===null)startupTiming.resultsAt=performance.now();
 return (data.response?.docs||[]).sort(()=>Math.random()-.5).map(item=>({colorHint:preferred,provider:'archive',id:item.identifier,url:'https://archive.org/cors/'+encodeURIComponent(item.identifier)+'/__ia_thumb.jpg',title:item.identifier,source:'https://archive.org/details/'+encodeURIComponent(item.identifier),author:'internet archive',license:'licenza nella pagina originale'}));
}
function useLightVideo(){return !!pools.video&&(pools.video.accepted<2||pools.video.ready.length<=1);}
function pickVideoVariant(variants,light){
 // iPhone: smoothness over quality. Light transcodes only, no MPEG-4 Part 2 .mov.
 const target=iosVideo?((pools.video?.accepted||0)<2?240:360):light?((pools.video?.accepted||0)<2?240:360):540;
 return variants.filter(d=>Number(d.height)>0&&Number(d.height)<=(iosVideo?480:720)&&(!iosVideo||iosVideo.canPlay(d)&&!/mp4v/.test(d.type||''))).sort((a,b)=>{const score=d=>Math.abs(Number(d.height)-target)+(iosVideo?(Number(d.height)>target?60:0):light&&Number(d.height)>480?500:!light&&Number(d.height)<480?250:0);return score(a)-score(b);})[0];
}
async function fetchCommons(kind){
 const entries=[];
   const preferred=colorFallback('commons:'+kind,kind);if(stills&&preferred)pools[kind].colorBatches=(pools[kind].colorBatches||0)+1;
   const term='(haswbstatement:P462=Q1088 OR incategory:Blue)';
   const generator=stills&&kind==='image'?{generator:'search',gsrsearch:'filetype:bitmap '+(preferred?(Math.random()<.5?'haswbstatement:P462=Q1088 ':'incategory:Blue '):'')+commonsImageExclusions,gsrsort:'random',gsrnamespace:'6',gsrlimit:'50',requestid:String(Math.random())}:kind==='image'&&!preferred?{generator:'random',grnnamespace:'6',grnlimit:'50',...(stills?{requestid:String(Math.random())}:{})}:kind==='video'?{generator:'search',gsrsearch:'filetype:video '+(preferred?term:''),gsrsort:'random',gsrnamespace:'6',gsrlimit:'12',requestid:String(Math.random())}:{generator:'search',gsrsearch:(preferred?term:''),gsrnamespace:'6',gsrlimit:'50',gsroffset:String(Math.floor(Math.random()*(preferred?500:9000)))};
   const params=kind==='video'?{...generator,prop:'videoinfo',viprop:'url|mime|derivatives|extmetadata',viextmetadatafilter:'Artist|LicenseShortName|LicenseUrl'}:{...generator,prop:'imageinfo',iiprop:stills?'url|mime':'url|mime|extmetadata',iiurlwidth:String(settings.quality),iiextmetadatafilter:'Artist|LicenseShortName|LicenseUrl'};
   let pages=await api(params);if(!pages.length&&generator.generator==='search'&&Number(generator.gsroffset)>0)pages=await api({...params,gsroffset:'0'});
   for(const page of pages){
    const data=(kind==='video'?page.videoinfo:page.imageinfo)?.[0];if(!data)continue;
    let url=data.thumburl,videoVariants;
    if(kind==='video'){
     const test=document.createElement('video');
     videoVariants=(data.derivatives||[]).filter(d=>d.src&&Number(d.width)>0&&Number(d.width)<=1280&&Number(d.height)<=720&&test.canPlayType(d.type||'video/webm'));
     url=videoVariants[0]?.src;
    }else if(!/^image\/(jpeg|png|webp)$/.test(data.mime||''))continue;
    if(!url)continue;const meta=data.extmetadata||{};entries.push({colorHint:preferred,provider:'commons',url,videoVariants,title:page.title,source:data.descriptionurl||'https://commons.wikimedia.org/?curid='+page.pageid,author:clean(meta.Artist?.value),license:clean(meta.LicenseShortName?.value)});
   }
 return entries;
}
function fetchBatch(kind){
 const pool=pools[kind];if(pool.urls.length>(kind==='video'?15:70))return;
 pool.requests ||= {};
 // iPhone: light and smooth over full coverage. Live search uses Commons only
 // (240–360p transcodes, one request); the list covers the gaps.
 for(const provider of (sources==='both'?(iosVideo&&kind==='video'?['commons']:['commons','archive']):[sources])){
  const state=pool.requests[provider] ||= {fetching:false,next:0};
  if(state.fetching||Date.now()<state.next)continue;state.fetching=true;state.failed=false;pool.fetching=true;
  const version=revision;
  (provider==='commons'?fetchCommons(kind):fetchArchive(kind)).then(entries=>{
   if(version!==revision)return;
   for(const item of entries){if(played.has(mediaKey(item))||(baseStills&&item.fingerprint&&played.has(item.fingerprint))||pool.seen.has(item.source))continue;pool.seen.add(item.source);if(stills&&item.colorHint&&!pool.ready.length)pool.urls.unshift({...item,kind});else pool.urls.splice(Math.floor(Math.random()*(pool.urls.length+1)),0,{...item,kind});}
  }).catch(error=>{state.failed=true;lastError=error.message;pool.lastError=error.message;}).finally(()=>{
   state.fetching=false;state.next=Date.now()+(state.failed?3500:kind==='video'?600:250);pool.fetching=Object.values(pool.requests).some(s=>s.fetching);pump();
  });
 }
}
async function prepare(item){
 const pool=pools[item.kind],version=revision,media=document.createElement(item.kind==='video'?'video':'img');media.crossOrigin='anonymous';
 if(item.provider==='archive')pool.archiveLoading=(pool.archiveLoading||0)+1;
 const light=item.kind==='video'&&useLightVideo();
 const entry={...item,media,match:null,revision:version,startTime:0,qualityBand:light?'240–480p':'480–720p'};let stage='metadati';
 try{
  if(item.kind==='image')media.decoding='async';
  if(item.kind==='video'&&item.videoVariants){const variant=pickVideoVariant(item.videoVariants,light);if(!variant)throw Error('nessun video nella fascia richiesta');item.url=variant.src;}
  if(item.provider==='archive'&&!item.verified&&(item.kind==='video'||!stills&&settings.quality>320)){
   try{
    const response=await fetch('https://archive.org/metadata/'+encodeURIComponent(item.id),{signal:AbortSignal.timeout(5000)});
    if(response.ok){
     const metadata=await response.json();
     if(item.kind==='video'){
      const height=f=>Number(f.height)||Number(f.name.match(/(?:^|[._ -])(240|360|480|540|720|1080)p(?:[._ -]|$)/i)?.[1])||0;
      const files=(metadata.files||[]).filter(f=>/\.(mp4|webm)$/i.test(f.name)&&Number(f.size)>0&&Number(f.size)<150000000&&height(f)<=720&&(!iosVideo||iosVideo.canPlay({src:f.name}))).sort((a,b)=>{
       const rank=f=>{const h=height(f),low=/512kb|low|240p|360p/i.test(f.name+' '+f.format)||(h>0&&h<480);if(light)return h>=240&&h<=480?0:low?1:3;return h>=480&&h<=720?0:low?3:1;};
       return rank(a)-rank(b)||Number(a.size)-Number(b.size);
      });
      if(!files.length)throw Error('nessun video leggero');entry.filename=files[0].name;item.url='https://archive.org/cors/'+encodeURIComponent(item.id)+'/'+files[0].name.split('/').map(encodeURIComponent).join('/');
     }else{
      const files=(metadata.files||[]).filter(f=>/\.(jpe?g|png|webp)$/i.test(f.name)&&Number(f.size)>0&&Number(f.size)<=Math.min(1200000,settings.quality*settings.quality));
      const file=files.filter(f=>f.source==='original').sort((a,b)=>Number(a.size)-Number(b.size))[0]||files.sort((a,b)=>Number(b.size)-Number(a.size))[0];
      if(file)item.url='https://archive.org/cors/'+encodeURIComponent(item.id)+'/'+file.name.split('/').map(encodeURIComponent).join('/');
     }
     if(metadata.metadata?.title)entry.title=clean(metadata.metadata.title);
    }else if(item.kind==='video')throw Error('metadati video non disponibili');
   }catch(error){if(item.kind==='video')throw error;}
  }
  if(iosVideo&&item.kind==='video'){stage='streaming sul dominio locale';entry.remoteURL=item.url;item.url=await iosVideo.mediaURL(item.url);}
  stage='caricamento';const loadStarted=performance.now(),loaded=waitEvent(media,item.kind==='video'?'loadeddata':'load',stills?4000:10000);
  if(item.kind==='video'){media.muted=true;media.playsInline=true;media.preload='auto';iosVideo?.attach(media);}media.src=item.url;
  if(item.kind==='video'&&iosVideo)void iosVideo.start(media).catch(()=>{});
  await loaded;pool.loaded++;pool.failStreak=0;pool.loadMs+=performance.now()-loadStarted;if(stills||iosVideo){if(lastError===pool.lastError)lastError='';pool.lastError='';}
  if(item.kind==='video'){
   if(iosVideo)media.pause();
   if(media.videoHeight>720)throw Error('nessun video leggero');
   for(const at of [...new Set([item.verified?Number(item.startTime)||0:0,2,5])]){if(at){if(!Number.isFinite(media.duration)||media.duration<=at+.5)continue;stage='seek';const seek=waitEvent(media,'seeked',5000);media.currentTime=at;await seek;}stage='lettura pixel blu';entry.match=detect(media);checked++;pool.checked++;if(entry.match){entry.startTime=media.currentTime;break;}}
  }else{
   if(baseStills){await media.decode();if(startupTiming.loadedAt===null)startupTiming.loadedAt=performance.now();}
   // Archive thumbnails can have little or no choice of resolution; quality caps their decode/display bitmap.
   if(!stills&&item.provider==='archive' && typeof createImageBitmap==='function'){
    const ratio=Math.min(1,settings.quality/Math.max(media.naturalWidth,media.naturalHeight));
    if(ratio<1){const bitmap=await createImageBitmap(media,{resizeWidth:Math.round(media.naturalWidth*ratio),resizeHeight:Math.round(media.naturalHeight*ratio)});const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);bitmap.close();const resized=waitEvent(media,'load');media.src=c.toDataURL('image/jpeg',.85);await resized;}
   }
   if(baseStills){entry.fingerprint=imageFingerprint(media);if(played.has(entry.fingerprint)||contentSeen.has(entry.fingerprint)){pool.discarded++;release(entry);return;}}
   const analysisStarted=performance.now();entry.match=detect(media);pool.analysisMs+=performance.now()-analysisStarted;checked++;pool.checked++;
  }
  if(item.kind==='video'&&entry.match){
   stage='cattura primo frame';
   if(!iosVideo&&current&&media.readyState<3)await waitEvent(media,'canplay',7000);
   entry.poster=document.createElement('canvas');entry.poster.width=entry.match.w;entry.poster.height=entry.match.h;
   entry.poster.getContext('2d').drawImage(media,0,0,entry.poster.width,entry.poster.height);
  }
  if(version!==revision||!entry.match||played.has(mediaKey(entry))){pool.discarded++;release(entry);return;}
  if(baseStills&&startupTiming.readyAt===null)startupTiming.readyAt=performance.now();
  if(baseStills&&entry.fingerprint)contentSeen.add(entry.fingerprint);accepted++;pool.accepted++;recordCandidate(entry);if(item.kind==='video')media.preload='metadata';pool.ready.push(entry);if(!current&&!playbackPaused)advance();
 }catch(error){pool.failures++;if(iosVideo&&item.kind==='video'&&['caricamento','seek'].includes(stage)&&++pool.failStreak>=3)pool.coolUntil=performance.now()+Math.min(30000,1000*2**(pool.failStreak-2));if(error.message==='caricamento scaduto')pool.timeouts++;if(!['nessun video leggero','nessun video nella fascia richiesta'].includes(error.message)){lastError=iosVideo?stage+' · '+error.name+': '+error.message:error.message;pool.lastError=lastError;}if(iosVideo&&error.name==='SecurityError')resetBlueAnalysis();pool.discarded++;release(entry);}finally{pool.loading--;if(item.fromList)pool.listLoading--;if(item.provider==='archive')pool.archiveLoading--;pump();}
}
function paintIntroFrame(image,item){
 const m=item.match,zoom=settings.size/m.side,{x,y,size}=item.tile;
 ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const screen of screens()){
  const cx=screen.x+screen.w/2,cy=screen.y+screen.h/2;
  ctx.save();ctx.beginPath();ctx.rect(screen.x,screen.y,screen.w,screen.h);ctx.clip();
  if(screen.square)ctx.drawImage(image,x+m.x-m.side/2+.5,y+m.y-m.side/2+.5,m.side-1,m.side-1,cx-settings.size/2,cy-settings.size/2,settings.size,settings.size);
  else ctx.drawImage(image,x+.5,y+.5,size-1,size-1,cx-m.x*zoom,cy-m.y*zoom,size*zoom,size*zoom);
  ctx.restore();
 }
}
async function startIntroSequence(){
 if(!introEnabled||(sources==='commons'&&!iosVideo)||typeof BLUENESS_STARTUP==='undefined'||!BLUENESS_STARTUP)return;
 const frames=[...BLUENESS_STARTUP.frames];
 for(let i=frames.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[frames[i],frames[j]]=[frames[j],frames[i]];}
 if(!frames.length)return;
 const image=new Image();image.src=BLUENESS_STARTUP.image;try{await image.decode();}catch{return;}
 let index=0;const draw=()=>{
  if(current){image.src='';return;}
  if(!playbackPaused&&!document.hidden&&document.getElementById('blueness-intro')){
   const item=frames[index];introSequence.push({item,at:performance.now(),scene:{width:canvas.width,height:canvas.height,size:settings.size,screens:screens()}});introFrame={image,item};paintIntroFrame(image,item);previewShown++;
   if(++index===frames.length){index=0;const last=item;for(let i=frames.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[frames[i],frames[j]]=[frames[j],frames[i]];}if(frames.length>1&&frames[0]===last)[frames[0],frames[1]]=[frames[1],frames[0]];}
  }
  if(performance.now()<introEndsAt)setTimeout(draw,50);
  else if(!current&&!introEnded){introEnded=true;introFrame=null;ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);}
 };draw();
}
function pump(){
 if(document.hidden)return;
 for(const [kind,pool]of Object.entries(pools)){
  // iPhone: list only for the first 3 videos and 30 s; live once playback has settled.
  const liveAllowed=kind!=='video'||!iosVideo||shown>=3&&performance.now()-startedAt>=30000;
  // Live discovery otherwise runs from the start; the list never holds it back.
  if(liveAllowed&&pool.urls.length<(kind==='video'?8:45)&&!(stills&&!baseStills&&pool.accepted===0&&(pool.loading>0||pool.urls.some(item=>item.verified))))fetchBatch(kind);
  const concurrency=kind==='video'?(iosVideo?1:pool.ready.length<2?3:2):8,limit=kind==='video'?VIDEO_QUEUE_LIMIT:IMAGE_QUEUE_LIMIT;
  // iPhone: after repeated load failures (e.g. HTTP 429 from Wikimedia) wait
  // instead of burning through candidates and adding to the rate limit.
  const cooling=kind==='video'&&iosVideo&&performance.now()<(pool.coolUntil||0);
  if(cooling&&!pool.coolTimer)pool.coolTimer=setTimeout(()=>{pool.coolTimer=0;pump();},pool.coolUntil-performance.now()+50);
  // Exactly one list video is kept ready (or preparing) as the fallback.
  if(kind==='video'&&pool.list.length&&!pool.listLoading&&(!liveAllowed?pool.ready.length<VIDEO_QUEUE_LIMIT:!pool.ready.some(entry=>entry.fromList))&&pool.loading<concurrency){pool.loading++;pool.listLoading++;prepare(pool.list.shift());}
  while(liveAllowed&&!cooling&&pool.loading<concurrency&&pool.ready.length+pool.loading<limit&&pool.urls.length){
   let index=0;
   if(sources==='both'&&iosVideo){const other=pool.urls.findIndex(item=>item.provider!==pool.lastProvider);if(other>=0)index=other;}
   else if(sources==='both'&&(pool.archiveLoading||0)>=1){const commons=pool.urls.findIndex(item=>item.provider==='commons');if(commons>=0)index=commons;}
   pool.lastProvider=pool.urls[index].provider;
   pool.loading++;prepare(pool.urls.splice(index,1)[0]);
  }
 }
 if(baseStills&&!current&&!playbackPaused&&pools.image.ready.length)advance();
}
function select(entry,fromHistory=false){
 if(!fromHistory&&(played.has(mediaKey(entry))||(baseStills&&entry.fingerprint&&played.has(entry.fingerprint)))){release(entry);pump();return;}
 if(!fromHistory)rememberPlayed(entry);
 if(introEnabled&&!fromHistory)entry.hideIntroBorder=!baseStills&&shown<1;
 recording.sample();if(current?.kind==='video'){current.media.pause();iosVideo?.park(current.media);}current=entry;if(introEnabled&&introFrame){introFrame.image.src='';introFrame=null;}shown++;shownAt=performance.now();if(introEnabled&&!firstLiveAt)firstLiveAt=shownAt;if(playbackPaused)pausedAt=shownAt;lostAt=0;lastDetect=current.revision!==revision?0:shownAt;lastPaintKey='';
 current.pendingCamera=null;current.cameraAnchor=current.match;current.lastGoodCamera=shownAt;current.lastCameraMove=shownAt;
 if(current.kind==='image')mixedNeedsImage=false;
 if(!fromHistory){reviewing=false;history.splice(historyIndex+1).forEach(release);history.push(entry);if(history.length>30)release(history.shift());historyIndex=history.length-1;while(history.filter(e=>e.kind==='video').length>4){const i=history.findIndex(e=>e.kind==='video'&&e!==current);if(i<0)break;release(history.splice(i,1)[0]);historyIndex=history.length-1;}}
 if(current.kind==='video'){
  // Fresh queue entries are already parked on the verified frame: do not seek again.
  if(fromHistory)iosVideo?.restore(current.media);
  if(fromHistory&&Math.abs(current.media.currentTime-current.startTime)>.05)current.media.currentTime=current.startTime;
  const entry=current;entry.firstFrameReady=false;entry.media.muted=muted;entry.media.preload='auto';const epoch=entry.frameEpoch=(entry.frameEpoch||0)+1;
  if(iosVideo){entry.firstFrameReady=entry.media.readyState>=2;}
  else if(entry.media.requestVideoFrameCallback){const onFrame=()=>{if(entry.frameEpoch!==epoch)return;entry.firstFrameReady=true;entry.frameSerial=(entry.frameSerial||0)+1;if(current===entry)entry.media.requestVideoFrameCallback(onFrame);};entry.media.requestVideoFrameCallback(onFrame);}
  else entry.media.addEventListener('playing',()=>{entry.firstFrameReady=true;},{once:true});
  if(!playbackPaused)(iosVideo?iosVideo.play(entry.media):entry.media.play()).catch(error=>{lastError=error.message;});else pausedAt=shownAt;
 }
 if(!fromHistory){if(iosVideo){try{captureRoute(current);}catch(error){lastError='cattura export · '+error.name+': '+error.message;}}else captureRoute(current);}
 sourceLink.href=current.source;sourceLink.textContent='fonte: '+clean(current.title);renderInfo();pump();
}
function back(){if(historyIndex>0){reviewing=true;select(history[--historyIndex],true);}}
function advance(manual=false){
 if(manual&&historyIndex<history.length-1){reviewing=true;select(history[++historyIndex],true);return;}if(manual)reviewing=false;
 let kind=mode==='video'?'video':'image';
 if(mixed && !mixedNeedsImage && current?.kind!=='video' && pools.video.ready.length)kind='video';
 const ready=pools[kind]?.ready;
 if(kind==='video'&&ready?.length){
  const now=performance.now();if(!current&&now<burstMinAt)return;
  // The first video stays at least 3 s; a click is immediate.
  if(current&&!manual&&shown===1&&now-shownAt<3000)return;
  // Desktop: the burst waits up to 4 s for a real live video before the list.
  if(!current&&!iosVideo&&now<introEndsAt&&!ready.some(entry=>!entry.fromList))return;
  // A ready live video always wins; the list video is the fallback.
  let index=ready.findIndex(entry=>!entry.fromList);
  // No live video ready at the change: the list video goes in at once, no waiting.
  if(index<0){
   index=0;
  }
  select(ready.splice(index,1)[0]);return;
 }
 const entry=pools[kind]?.ready.shift() || (!current&&mixed?pools.image.ready.shift():null);if(entry)select(entry);else pump();
}
function renderInfo(){
 const status=Object.entries(pools).map(([kind,pool])=>{
  const label=kind==='video'?'video':'immagini',limit=kind==='video'?Math.max(VIDEO_QUEUE_LIMIT,pool.ready.length):IMAGE_QUEUE_LIMIT;
  const state=playbackPaused?'pausa · precaricamento attivo':pool.ready.length>=limit?'coda pronta':pool.fetching?'ricerca negli archivi':pool.loading?(stills?'download immagini in background':'caricamento e analisi del blu'):Date.now()<pool.next?'attesa della prossima ricerca':'ricerca attiva';
  return `${label} · ${state}\n${pool.ready.length} / ${limit} pronti · ${pool.loading} in preparazione · ${pool.urls.length} candidati\n${pool.checked} analisi · ${pool.accepted} match · ${pool.discarded} scartati${stills?'\ncaricamento '+Math.round(pool.loadMs/Math.max(1,pool.loaded))+' ms · blu '+(pool.analysisMs/Math.max(1,pool.checked)).toFixed(1)+' ms · '+pool.timeouts+' timeout · '+(pool.colorBatches||0)+' ricerche tag blu':''}${pool.lastError?'\nultimo errore: '+pool.lastError:''}`;
 }).join('\n\n');const mobile=iosVideo?.status,summary=status+(current?.kind==='video'?'\nvideo corrente: '+(current.fromList?'dalla lista':'live'):'')+(iosVideo?'\n\niOS relay · 25/10-r26':'')+(mobile?'\n'+mobile.renderer+' · '+(mobile.paused?'video in pausa':'video in riproduzione')+' · '+mobile.time.toFixed(2)+' s\nreadyState '+mobile.readyState+' · rete '+mobile.networkState+' · ultimo avanzamento '+mobile.stalledMs+' ms'+(mobile.waitingForTap?' · serve un tocco':'')+(mobile.error?'\n'+mobile.error:''):'');if(searchStatus.textContent!==summary)searchStatus.textContent=summary;
 sourceLink.hidden=!current;
 if(!infoVisible)return;info.replaceChildren();const p=document.createElement('p');p.textContent=`${mode} · ${checked} analisi · ${accepted} match · ${shown} mostrati\n${Object.entries(pools).map(([k,v])=>k+': '+v.ready.length+' pronti').join(' · ')}\n${current?.match?Math.round(current.match.ratio*100)+'% nel range blu · zoom '+current.match.zoom.toFixed(2)+'× · area sorgente '+current.match.side+' px':'ricerca in corso'}${lastError?'\nultimo errore: '+lastError:''}`;info.append(p);
 if(current){const link=document.createElement('a');link.href=current.source;link.target='_blank';link.rel='noopener';link.textContent=clean(current.title)+' · '+current.author+' · '+current.license;info.append(link);}
}
function screens(){if(!settings.dual)return[{x:0,y:0,w:canvas.width,h:canvas.height,square:false}];const w=Math.min(canvas.width/2,canvas.height*16/9),h=w*9/16,y=(canvas.height-h)/2,x=(canvas.width-2*w)/2;return[{x,y,w,h,square:false},{x:x+w,y,w,h,square:true}];}
function alignIntro(){
 if(!introEnabled)return;
 const svg=document.querySelector('#blueness-intro svg'),anchor=svg?.querySelector('[data-blue-anchor]');if(!anchor)return;
 layoutBluenessIntro(svg,canvas.width,canvas.height,settings.size,screens()[0]);
 if(introFrame&&!current)paintIntroFrame(introFrame.image,introFrame.item);
}
function drawScreen(target,screen,squareOnly,entry=current,border=true,frozen=false){
 const {x,y,w,h}=screen,cx=x+w/2,cy=y+h/2,size=settings.size,m=entry?.match;
 target.save();target.beginPath();target.rect(x,y,w,h);target.clip();
 if(m){
  const media=frozen&&entry.poster?entry.poster:entry.kind==='video'&&(!entry.firstFrameReady||entry.media.seeking||entry.media.readyState<2)?entry.poster:entry.media;
  if(!media){target.restore();return;}
  if(squareOnly){const sw=media.videoWidth||media.naturalWidth||media.width,sh=media.videoHeight||media.naturalHeight||media.height;target.drawImage(media,(m.x-m.side/2)*sw/m.w,(m.y-m.side/2)*sh/m.h,m.side*sw/m.w,m.side*sh/m.h,cx-size/2,cy-size/2,size,size);}
  else target.drawImage(media,cx-m.x*m.zoom,cy-m.y*m.zoom,m.w*m.zoom,m.h*m.zoom);
 }else{target.fillStyle='#0000ff';target.fillRect(Math.round(cx-size/2),Math.round(cy-size/2),Math.round(size),Math.round(size));}
 if(border&&m&&!entry.hideIntroBorder&&(!settings.dual&&!(squareWindow&&!squareWindow.closed)||settings.showBorder)){target.lineWidth=1;target.strokeStyle='#fff';target.strokeRect(Math.round(cx-size/2)+.5,Math.round(cy-size/2)+.5,Math.round(size),Math.round(size));}target.restore();
}
function frame(now){
 requestAnimationFrame(frame);if(document.hidden)return;if(playbackPaused){if(now-lastInfo>1000){renderInfo();lastInfo=now;}return;}
 if(iosVideo&&current?.kind==='video'){iosVideo.tick(current.media);if(current.media.readyState>=2&&!current.media.seeking)current.firstFrameReady=true;
  // Never sit on a buffering video while a verified reserve is ready.
  if(!reviewing&&pools.video.ready.length&&iosVideo.stalledFor(current.media)>=1500){advance();return;}}
 if(baseStills&&!current&&pools.image.ready.length)advance();
 if(mode==='video'&&!current&&pools.video.ready.length)advance();
 if(current){
  const maxSeconds=settings.seconds;
  const expired=current.kind==='video'?(now-shownAt>=maxSeconds*1000||current.media.ended):now-shownAt>=1000/settings.fps;
  if(expired&&(!reviewing||current.kind==='video')){
   if(mixed&&current.kind==='video'){
    current.media.pause();mixedNeedsImage=true;const image=pools.image.ready.shift();if(image)select(image);else{current=null;lastPaintKey='';pump();}
   }else advance();
  }
 }
 if(current&&(current.kind!=='video'||(current.firstFrameReady&&!current.media.seeking&&current.media.readyState>=2))&&(!lastDetect||(current.kind==='video'&&now-lastDetect>=1000/settings.hz))){
  lastDetect=now;const mediaFrame=current.kind==='video'?current.media.currentTime:null;
  if(current.kind!=='video'||current.detectedTime!==mediaFrame||current.revision!==revision){current.detectedTime=mediaFrame;try{current.match=stabilizeCamera(current,detect(current.media,current.cameraAnchor||current.match),now);if(current.match)current.cameraAnchor=current.match;current.revision=revision;}catch(error){lastError=(iosVideo?'tracking blu · '+error.name+': ':'')+error.message;current.match=null;if(iosVideo&&error.name==='SecurityError'){resetBlueAnalysis();const failed=current;current=null;const index=history.indexOf(failed);if(index>=0)history.splice(index,1);historyIndex=history.length-1;release(failed);lastPaintKey='';advance();return;}}
  if(!current.match){if(!lostAt)lostAt=now;if(now-lostAt>=0){if(mixed&&current.kind==='video'){current.media.pause();mixedNeedsImage=true;current=null;lastPaintKey='';advance();}else advance();}}else lostAt=0;}
 }
 const nativeEnabled=!settings.dual&&!(squareWindow&&!squareWindow.closed);
 const nativeVideo=iosVideo?.present(current,screens()[0],settings.size,nativeEnabled)||false;
 const upcoming=mode==='video'?(pools.video.ready.find(entry=>!entry.fromList)||pools.video.ready[0]):null;
 iosVideo?.stage(upcoming,screens()[0],nativeEnabled);
 const paintKey=[!!(squareWindow&&!squareWindow.closed),shown,revision,settings.showBorder,settings.dual,canvas.width,canvas.height,current?.kind==='video'?(nativeVideo?'native':iosVideo?Math.floor(current.media.currentTime*30):current.media.requestVideoFrameCallback?current.frameSerial:current.media.currentTime):current?.match?'match':'waiting',current?.match?.x,current?.match?.y,current?.match?.zoom].join(':');
 if(paintKey!==lastPaintKey&&(current?.match||shown===0&&!baseStills)){
  // With native iOS presentation, the key changes only on camera/scene changes:
  // retain a valid canvas frame underneath if the blue match is briefly lost.
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);for(const screen of screens())drawScreen(ctx,screen,screen.square);
  if(squareWindow&&!squareWindow.closed){const c=squareWindow.document.querySelector('canvas');if(c){if(c.width!==squareWindow.innerWidth||c.height!==squareWindow.innerHeight){c.width=squareWindow.innerWidth;c.height=squareWindow.innerHeight;}const cctx=c.getContext('2d');cctx.fillStyle='#000';cctx.fillRect(0,0,c.width,c.height);drawScreen(cctx,{x:0,y:0,w:c.width,h:c.height},true);}}
  if(baseStills&&current?.match&&startupTiming.paintedAt===null)startupTiming.paintedAt=performance.now();
  stillsExporter?.capture();
  lastPaintKey=paintKey;
  // Images reveal the first live frame; videos keep the overlay through the first clip.
  if(introEnabled&&current?.match){const intro=document.getElementById('blueness-intro');if(intro){intro.liveSources.add(current.source);if(intro.dataset.dismiss==='1'||intro.liveSources.size>=(baseStills?1:2))intro.remove();}}
 }
 if(now-lastInfo>1000){renderInfo();lastInfo=now;}
}
function togglePlaybackPause(){
 playbackPaused=!playbackPaused;const now=performance.now();
 if(playbackPaused){pausedAt=now;if(current?.kind==='video')current.media.pause();}
 else{if(current){const held=now-pausedAt;shownAt+=held;current.lastCameraMove+=held;current.lastGoodCamera+=held;lastDetect=now;if(current.kind==='video')(iosVideo?iosVideo.play(current.media):current.media.play()).catch(error=>{lastError=error.message;});}else advance();}
 recording.sample();renderInfo();pump();
}
addEventListener('keydown',event=>{
 if(event.key===' '&&!event.target.closest('input,textarea,select,button,[contenteditable="true"]')){event.preventDefault();if(!event.repeat)togglePlaybackPause();return;}
 if(event.target instanceof HTMLInputElement&&event.key.startsWith('Arrow'))return;
 const key=event.key.toLowerCase();if(['c','i','f','m','p','j','arrowright','arrowleft'].includes(key))event.preventDefault();
 if(key==='c'||key==='i'){controls.hidden=!controls.hidden;infoVisible=!controls.hidden;info.hidden=!infoVisible;renderInfo();}
 if(!stills){if(key==='p')exportRoute();if(key==='j')exportJPEG();}
 if(key==='arrowright')advance(true);if(key==='arrowleft')back();
 if(key==='m'){muted=!muted;if(current?.kind==='video')current.media.muted=muted;recording.syncAudioMonitor();}
 if(key==='f')(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(()=>{});
});
// Clicks: the first one only turns the sound on (iPhone: in its helper). During
// the burst and the first video a click does nothing else; from the second
// video on it advances, if a video is ready.
let clicks=0;addEventListener('click',()=>{clicks++;if(clicks===1&&!stills&&!iosVideo){muted=false;if(current?.kind==='video')current.media.muted=false;}},true);
if(!baseStills)canvas.addEventListener('click',()=>{
 if(mode!=='video'){advance(true);return;}
 if(clicks<2||shown<2)return;
 if(historyIndex<history.length-1||pools.video.ready.length)advance(true);
});
if(baseStills&&matchMedia('(pointer: coarse)').matches){const button=document.createElement('button');button.textContent='c';button.setAttribute('aria-label','controlli');button.style.cssText='position:fixed;right:12px;bottom:12px;z-index:25;padding:12px;font:inherit;color:white;text-shadow:0 1px 2px black;';button.onclick=()=>{controls.hidden=!controls.hidden;infoVisible=!controls.hidden;info.hidden=!infoVisible;renderInfo();};document.body.append(button);}
addEventListener('visibilitychange',()=>{if(current?.kind==='video')document.hidden||playbackPaused?current.media.pause():(iosVideo?iosVideo.play(current.media):current.media.play()).catch(()=>{});pump();});
Object.defineProperty(window,'blueStartupTiming',{get:()=>({...startupTiming})});
Object.defineProperty(window,'blueStatus',{get:()=>({phase:baseStills?(current?'live':'startup'):undefined,previewShown:baseStills?previewShown:undefined,verifiedImages:baseStills?[...blueCatalog.values()]:undefined,routeFrames:route.length,paused:playbackPaused,queueLimit:VIDEO_QUEUE_LIMIT,mode,sources,analysis:{...analysisStats},checked,accepted,shown,history:history.length,historyIndex,ready:Object.fromEntries(Object.entries(pools).map(([k,p])=>[k,p.ready.length])),search:Object.fromEntries(Object.entries(pools).map(([k,p])=>[k,{fetching:p.fetching,preparing:p.loading,preparingArchive:p.archiveLoading||0,loaded:p.loaded,loadMs:p.loadMs,analysisMs:p.analysisMs,timeouts:p.timeouts,failures:p.failures,candidates:p.urls.length,checked:p.checked,accepted:p.accepted}])),current:current?.source,mediaURL:current?.media.currentSrc,fingerprint:current?.fingerprint,kind:current?.kind,match:current?.match,settings:{...settings},recording:recording.status,error:lastError})});
if(introEnabled&&typeof BLUENESS_INTRO_SVG==='string'&&BLUENESS_INTRO_SVG){
 const intro=document.createElement('div');intro.id='blueness-intro';intro.style.cssText='position:fixed;inset:0;z-index:20;display:grid;place-items:center;background:transparent;';intro.innerHTML=BLUENESS_INTRO_SVG;const svg=intro.querySelector('svg');if(svg){const direct=[...svg.children].filter(node=>node.tagName?.toLowerCase()==='path');if(!svg.querySelector('[data-intro-text]')&&direct.length>=3){const text=document.createElementNS(svg.namespaceURI,'g'),arrow=document.createElementNS(svg.namespaceURI,'g');text.dataset.introText='1';arrow.dataset.introArrow='1';svg.insertBefore(text,direct[0]);text.append(direct[0]);svg.insertBefore(arrow,direct[1]);arrow.append(direct[1],direct[2]);}svg.querySelector('rect:last-of-type')?.setAttribute('data-blue-anchor','1');svg.style.cssText='display:block;max-width:90vw;max-height:90dvh;width:100%;height:100%;';}document.body.append(intro);alignIntro();
 intro.liveSources=new Set();const dismiss=()=>{if(current?.match&&lastPaintKey)intro.remove();else intro.dataset.dismiss='1';};if(baseStills)intro.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();dismiss();},{once:true});
 // Video: a click on the SVG never removes it (it leaves with the second video).
 else intro.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
}
seedCandidates();renderInfo();pump();startIntroSequence();setInterval(pump,800);requestAnimationFrame(frame);
})();
