import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const helper=await readFile(new URL('../blueness-ios-video.js',import.meta.url),'utf8');
const flow=await readFile(new URL('../blue-flow.js',import.meta.url),'utf8');
function environment(ios=true){
 const nodes=[],videos=[],events={};
 class Video extends EventTarget{
  constructor(){super();this.attrs=new Map();this.style={};this.paused=true;this.readyState=0;this.videoWidth=320;this.videoHeight=180;this.currentTime=0;this.duration=10;this.plays=0;this.allowed=true;videos.push(this);}
  setAttribute(k,v){this.attrs.set(k,v);}removeAttribute(k){this.attrs.delete(k);if(k==='src')this.url='';}
  set src(value){this.url=value;if(!ios)queueMicrotask(()=>this.decoded());}get src(){return this.url;}
  decoded(){this.readyState=2;this.dispatchEvent(new Event('loadeddata'));}
  play(){this.plays++;if(!this.allowed)return Promise.reject(Object.assign(Error('gesture required'),{name:'NotAllowedError'}));this.paused=false;if(!this.readyState)queueMicrotask(()=>this.decoded());return Promise.resolve();}
  pause(){this.paused=true;}load(){this.readyState=0;}remove(){this.connected=false;}
  canPlayType(type){return ios&&type.includes('webm')?'':'probably';}
 }
 const document={body:{prepend(node){node.connected=true;nodes.unshift(node);},append(node){node.connected=true;nodes.push(node);}},createElement(kind){if(kind==='video')return new Video();return {style:{},setAttribute(){},getContext:()=>({drawImage(){}})};}};
 const context=vm.createContext({document,navigator:{userAgent:ios?'iPhone':'Macintosh',platform:ios?'iPhone':'MacIntel',maxTouchPoints:ios?5:0},addEventListener:(name,fn)=>events[name]=fn,Event,Promise,URL,location:{href:'https://tunnel.example/blueness/'},AbortSignal,setTimeout,clearTimeout,performance});
 vm.runInContext(helper,context);context.iosVideo=context.createBluenessIOSVideo();return {context,nodes,videos,events,Video};
}
test('desktop stays outside the iOS path; touch iPad desktop user agent is recognized',()=>{
 const {context,nodes}=environment(false);assert.equal(context.iosVideo,null);assert.equal(nodes.length,0);
 context.navigator.maxTouchPoints=5;assert.ok(context.createBluenessIOSVideo());
});
test('iOS videos attach inline and muted; rejected autoplay can be retried directly by tapping',async()=>{
 const {context,nodes,Video,events}=environment(),media=new Video(),ios=context.iosVideo;
 ios.attach(media);assert.ok(media.connected);assert.ok(media.muted&&media.defaultMuted&&media.playsInline);assert.equal(media.autoplay,false);assert.equal(media.attrs.has('autoplay'),false);
 assert.ok(media.attrs.has('playsinline'));assert.ok(!/display:none|visibility:hidden|left:-/.test(media.style.cssText));
 media.allowed=false;await ios.start(media);const button=nodes.find(node=>node.textContent==='tocca per avviare i video');assert.ok(button);assert.equal(button.hidden,false);
 media.allowed=true;button.onclick();assert.equal(media.plays,2,'play called synchronously in the tap');await Promise.resolve();await Promise.resolve();assert.equal(button.hidden,true);
 media.src='fixture.mp4';events.pagehide({persisted:true});assert.equal(media.src,'fixture.mp4','back-forward cache preserves the source');
 events.pagehide({persisted:false});assert.equal(media.src,'');ios.release(media);assert.equal(media.connected,false);
});
test('actual iOS preparation requests playback before loadeddata and parks a verified frame without canplay',async()=>{
 const {context,videos}=environment();let started=0;
 context.iosVideo.mediaURL=async url=>url;
 Object.assign(context,{stills:false,baseStills:false,pools:{video:{loading:1,archiveLoading:0,loaded:0,loadMs:0,checked:0,accepted:0,discarded:0,ready:[],failures:0}},revision:0,current:{source:'old'},checked:0,accepted:0,played:new Set(),playbackPaused:false,useLightVideo:()=>true,mediaKey:item=>item.source,recordCandidate(){},release(){},pump(){},advance(){started++;},detect:()=>({w:320,h:180,x:160,y:90,side:40,zoom:1.25}),lastError:''});
 vm.runInContext(flow.slice(flow.indexOf('function waitEvent('),flow.indexOf('async function api('))+flow.slice(flow.indexOf('function pickVideoVariant('),flow.indexOf('async function fetchCommons('))+flow.slice(flow.indexOf('async function prepare('),flow.indexOf('function paintIntroFrame(')),context);
 await context.prepare({kind:'video',provider:'commons',verified:true,url:'bad.webm',source:'https://example.test/live',videoVariants:[{src:'bad.webm',height:240,type:'video/webm; codecs="vp9, opus"'},{src:'good.mp4',height:360,type:'video/mp4'}]});
 const video=videos.find(v=>v.src==='good.mp4');assert.ok(video);assert.equal(video.plays,1);assert.equal(video.paused,true);assert.ok(video.connected);
 assert.equal(context.pools.video.failures,0);assert.equal(context.pools.video.ready.length,1);assert.equal(started,0);assert.equal(context.pools.video.ready[0].poster.width,320);
 assert.equal(context.pools.video.ready[0].media.preload,'metadata');
});
test('desktop catalog selection and paused preparation keep their previous behavior',async()=>{
 const {context,videos}=environment(false);
 Object.assign(context,{stills:false,baseStills:false,pools:{video:{loading:1,archiveLoading:0,loaded:0,loadMs:0,checked:0,accepted:0,discarded:0,ready:[],failures:0}},revision:0,current:null,checked:0,accepted:0,played:new Set(),playbackPaused:false,useLightVideo:()=>true,mediaKey:item=>item.source,recordCandidate(){},release(){},pump(){},advance(){},detect:()=>({w:320,h:180,x:160,y:90,side:40,zoom:1.25}),lastError:''});
 vm.runInContext(flow.slice(flow.indexOf('function waitEvent('),flow.indexOf('async function api('))+flow.slice(flow.indexOf('function pickVideoVariant('),flow.indexOf('async function fetchCommons('))+flow.slice(flow.indexOf('async function prepare('),flow.indexOf('function paintIntroFrame(')),context);
 await context.prepare({kind:'video',provider:'commons',verified:true,url:'same.webm',source:'https://example.test/desktop',videoVariants:[{src:'same.webm',height:240,type:'video/webm'},{src:'larger.mp4',height:360,type:'video/mp4'}]});
 assert.equal(videos[0].src,'same.webm');assert.equal(videos[0].plays,0);assert.ok(!videos[0].connected);assert.equal(context.pools.video.failures,0);assert.equal(context.pools.video.ready.length,1);
});
test('iOS pump prepares one video at a time and stops at two ready/preparing entries',()=>{
 const pool={urls:Array.from({length:8},()=>({provider:'commons'})),ready:[],loading:0,accepted:1};let loads=0;
 const context=vm.createContext({iosVideo:{},document:{hidden:false},pools:{video:pool},sources:'both',VIDEO_QUEUE_LIMIT:2,IMAGE_QUEUE_LIMIT:12,baseStills:false,fetchBatch(){},prepare(){loads++;},current:null,playbackPaused:false});
 vm.runInContext(flow.slice(flow.indexOf('function pump(){'),flow.indexOf('function select(')),context);context.pump();assert.equal(loads,1);assert.equal(pool.loading,1);
 pool.loading=0;pool.ready.push({},{});context.pump();assert.equal(loads,1);
});
test('only the active iOS video is recovered after an unexpected pause, with bounded retries',async()=>{
 const {context,Video,nodes}=environment();let now=100;context.performance={now:()=>now};
 const ios=context.iosVideo,current=new Video(),warming=new Video();ios.attach(current);ios.attach(warming);await ios.play(current);await ios.start(warming);
 warming.pause();ios.tick(warming);assert.equal(warming.plays,1,'a parked reserve is never resumed by the monitor');
 for(let i=0;i<2;i++){current.pause();now+=1100;ios.tick(current);await Promise.resolve();assert.equal(current.paused,false);}
 assert.equal(current.plays,3);
 current.pause();now+=1100;ios.tick(current);assert.equal(current.plays,3,'no endless play retry loop');assert.equal(ios.status.waitingForTap,true);
 assert.equal(nodes.find(node=>node.textContent==='tocca per avviare i video').hidden,false);
 context.document.hidden=true;now+=1100;ios.tick(current);assert.equal(current.plays,3);
 ios.release(current);context.document.hidden=false;ios.tick(current);assert.equal(current.plays,3,'released media is not restarted');
});
test('actual iOS rendering keeps moving even when video frame callbacks never fire; manual pause stays paused',()=>{
 let paints=0,ticks=0,callbacks=0;
 const media={readyState:2,currentTime:0,paused:false,seeking:false,ended:false,requestVideoFrameCallback(){callbacks++;},play:async()=>{},pause(){this.paused=true;}};
 const entry={kind:'video',media,source:'fixture',revision:0,startTime:0,match:{x:20,y:20,zoom:1}};
 const context=vm.createContext({iosVideo:{play:async()=>{},park(){},restore(){},present:()=>false,tick(){ticks++;}},current:null,recording:{sample(){}},played:new Set(),mediaKey:e=>e.source,baseStills:false,introEnabled:false,shown:0,shownAt:0,playbackPaused:false,pausedAt:0,lostAt:0,lastDetect:0,revision:0,lastPaintKey:'',muted:true,sourceLink:{},clean:x=>x,renderInfo(){},pump(){},performance:{now:()=>100},document:{hidden:false},requestAnimationFrame(){},settings:{seconds:30,hz:1,showBorder:false,dual:false},reviewing:false,mixed:false,canvas:{width:390,height:844},ctx:{fillRect(){paints++;}},screens:()=>[],squareWindow:null,stillsExporter:null,lastInfo:0,drawScreen(){}});
 vm.runInContext(flow.slice(flow.indexOf('function select('),flow.indexOf('function back('))+flow.slice(flow.indexOf('function frame(now){'),flow.indexOf('function togglePlaybackPause(')),context);
 context.select(entry,true);assert.equal(callbacks,0,'iOS does not depend on callbacks of the occluded decoder');assert.equal(entry.firstFrameReady,true);
 media.currentTime=.1;context.frame(150);media.currentTime=.2;context.frame(250);assert.equal(paints,2,'both media times repaint despite zero callbacks');assert.equal(ticks,2);
 context.playbackPaused=true;media.pause();context.frame(350);assert.equal(ticks,2);assert.equal(media.paused,true,'manual pause is not undone by recovery');
 context.playbackPaused=false;context.document.hidden=true;context.frame(450);assert.equal(ticks,2);
});
test('native presentation uses the canvas camera geometry and preserves first-video border rules',async()=>{
 const {context,Video,nodes}=environment(),ios=context.iosVideo,first=new Video(),second=new Video();ios.attach(first);ios.attach(second);await ios.play(first);
 const screen={x:0,y:0,w:390,h:844},match={w:320,h:180,x:130,y:80,zoom:2},entry={media:first,match,hideIntroBorder:true};
 assert.equal(ios.present(entry,screen,50,true),true);assert.ok(first.style.cssText.includes('left:-65px'));assert.ok(first.style.cssText.includes('top:262px'));assert.ok(first.style.cssText.includes('width:640px'));assert.ok(first.style.cssText.includes('height:360px'));assert.ok(first.style.cssText.includes('z-index:2'));
 const border=nodes.find(node=>node!==first&&node!==second);assert.equal(border.hidden,true);assert.equal(ios.status.renderer,'native');
 await ios.play(second);assert.ok(first.style.cssText.includes('width:2px'));assert.equal(ios.present({media:second,match,hideIntroBorder:false},screen,50,true),true);assert.equal(border.hidden,false);assert.equal(border.style.left,'170px');assert.equal(border.style.top,'397px');
 assert.equal(ios.present({media:second,match},screen,50,false),false,'dual-screen layout falls back to its original canvas renderer');assert.equal(border.hidden,true);assert.equal(ios.status.renderer,'canvas');
});
test('an advancing play promise without advancing frames exposes a gesture recovery instead of freezing silently',async()=>{
 const {context,Video}=environment();let now=100;context.performance={now:()=>now};const media=new Video(),ios=context.iosVideo;ios.attach(media);await ios.play(media);
 assert.equal(media.paused,false);now=4200;ios.tick(media);assert.equal(ios.status.waitingForTap,true);assert.equal(media.plays,1,'a frozen clock does not trigger endless automatic reloads');
});
test('a SecurityError in a candidate resets shared analysis before preparing a valid video',async()=>{
 const {context}=environment();let tainted=false,resets=0;
 context.iosVideo.mediaURL=async url=>url;
 const analysis={get width(){return 320;},set width(value){assert.equal(value,320);tainted=false;resets++;}},roiCanvas={get width(){return 40;},set width(value){assert.equal(value,40);resets++;}};
 Object.assign(context,{analysis,roiCanvas,stills:false,baseStills:false,pools:{video:{loading:2,archiveLoading:0,loaded:0,loadMs:0,checked:0,accepted:0,discarded:0,ready:[],failures:0}},revision:0,current:{source:'old'},checked:0,accepted:0,played:new Set(),playbackPaused:false,useLightVideo:()=>true,mediaKey:item=>item.source,recordCandidate(){},release(){},pump(){},advance(){},lastError:'',detect(media){if(media.src==='blocked.mp4')tainted=true;if(tainted)throw Object.assign(Error('The operation is insecure.'),{name:'SecurityError'});return {w:320,h:180,x:160,y:90,side:40,zoom:1.25};}});
 vm.runInContext(flow.slice(flow.indexOf('function resetBlueAnalysis('),flow.indexOf('function colorTest('))+flow.slice(flow.indexOf('function waitEvent('),flow.indexOf('async function api('))+flow.slice(flow.indexOf('async function prepare('),flow.indexOf('function paintIntroFrame(')),context);
 await context.prepare({kind:'video',provider:'commons',verified:true,url:'blocked.mp4',source:'https://example.test/blocked'});
 assert.equal(resets,2);assert.equal(context.pools.video.failures,1);assert.ok(context.lastError.startsWith('lettura pixel blu · SecurityError:'));
 await context.prepare({kind:'video',provider:'commons',verified:true,url:'valid.mp4',source:'https://example.test/valid'});
 assert.equal(context.pools.video.ready.length,1,'one bad candidate cannot poison all subsequent media');assert.equal(context.pools.video.ready[0].source,'https://example.test/valid');assert.equal(context.pools.video.failures,1);
});
test('a tracking SecurityError removes the failed current video so the next candidate can start',()=>{
 let released=0,resets=0,advances=0;const media={currentTime:1,readyState:2,ended:false},entry={kind:'video',media,firstFrameReady:true,match:{},revision:0};
 const context=vm.createContext({requestAnimationFrame(){},document:{hidden:false},playbackPaused:false,iosVideo:{tick(){}},current:entry,baseStills:false,performance,shownAt:0,settings:{seconds:30,hz:8},reviewing:false,mixed:false,lastDetect:0,lostAt:0,revision:0,lastError:'',lastPaintKey:'old',history:[entry],historyIndex:0,stabilizeCamera:(_,match)=>match,detect(){throw Object.assign(Error('The operation is insecure.'),{name:'SecurityError'});},resetBlueAnalysis(){resets++;},release(item){assert.equal(item,entry);released++;},advance(){advances++;}});
 vm.runInContext(flow.slice(flow.indexOf('function frame(now){'),flow.indexOf('function togglePlaybackPause(')),context);context.frame(100);
 assert.equal(context.current,null);assert.equal(context.history.length,0);assert.equal(released,1);assert.equal(resets,1);assert.equal(advances,1);assert.ok(context.lastError.startsWith('tracking blu · SecurityError:'));
});
test('an optional export capture failure cannot destroy the video selected for playback',()=>{
 const media={readyState:2,currentTime:0,play:async()=>{},pause(){}},entry={kind:'video',source:'fixture',media,match:{},revision:0,startTime:0};let plays=0;
 const context=vm.createContext({iosVideo:{play:async()=>{plays++;}},current:null,played:new Set(),mediaKey:e=>e.source,baseStills:false,rememberPlayed(){},introEnabled:false,recording:{sample(){}},shown:0,shownAt:0,performance:{now:()=>100},playbackPaused:false,pausedAt:0,lostAt:0,lastDetect:0,revision:0,lastPaintKey:'',history:[],historyIndex:-1,reviewing:false,muted:true,captureRoute(){throw Object.assign(Error('The operation is insecure.'),{name:'SecurityError'});},release(){throw Error('must not release selected media');},sourceLink:{},clean:x=>x,renderInfo(){},pump(){},lastError:''});
 vm.runInContext(flow.slice(flow.indexOf('function select('),flow.indexOf('function back(')),context);assert.doesNotThrow(()=>context.select(entry));assert.equal(context.current,entry);assert.equal(plays,1);assert.ok(context.lastError.startsWith('cattura export · SecurityError:'));
});
test('iOS video URLs use the page origin and capability discovery runs once without fetching video bytes',async()=>{
 const {context}=environment();let probes=0;context.fetch=async(url,options)=>{probes++;assert.equal(url.href,'https://tunnel.example/__blueness_media/status');assert.equal(options.credentials,'same-origin');return {ok:true,json:async()=>({service:'blueness-range-relay'})};};
 for(const remote of ['https://archive.org/cors/public/movie.mp4','https://upload.wikimedia.org/wikipedia/commons/a/movie.webm']){const result=new URL(await context.iosVideo.mediaURL(remote));assert.equal(result.origin,'https://tunnel.example');assert.equal(result.pathname,'/__blueness_media/video');assert.equal(result.searchParams.get('url'),remote);}
 assert.equal(probes,1);
});
test('both sources remain available on iOS and desktop',()=>{
 for(const [ios,expected] of [[true,'both'],[false,'both']]){
  const context=vm.createContext({document:{body:{dataset:{project:'movements',mode:'video',sources:'both'}}},createBluenessIOSVideo:()=>ios?{}:null,window:{}});
  vm.runInContext(flow.slice(0,flow.indexOf('const preferencesKey='))+'window.initialSources=sources;})();',context);assert.equal(context.window.initialSources,expected);
 }
});
test('an absent relay produces an explicit setup error instead of starting a cross-origin decoder',async()=>{
 const {context}=environment();context.fetch=async()=>({ok:false});await assert.rejects(context.iosVideo.mediaURL('https://archive.org/cors/public/movie.mp4'),/streaming mobile non attivo/);
});
test('verified candidates store the original remote URL rather than the temporary devtunnel URL',()=>{
 let saved;const context=vm.createContext({stills:false,baseStills:false,iosVideo:{},blueCatalog:new Map(),mediaKey:e=>e.source,catalogTimer:null,clearTimeout(){},setTimeout(fn){fn();return 1;},localStorage:{setItem(key,value){saved=JSON.parse(value);}}});
 vm.runInContext(flow.slice(flow.indexOf('function recordCandidate('),flow.indexOf('function seedCandidates(')),context);context.recordCandidate({source:'https://archive.org/details/item',kind:'video',url:'original-placeholder',remoteURL:'https://archive.org/download/item/movie.mp4',media:{currentSrc:'https://tunnel.example/__blueness_media/video?url=remote'}});assert.equal(saved[0].url,'https://archive.org/download/item/movie.mp4');
});
test('only iOS cold video discovery uses blue metadata; live and desktop stay general',()=>{
 const code=flow.slice(flow.indexOf('function colorFallback('),flow.indexOf('async function fetchArchive('));
 const context=vm.createContext({iosVideo:{},current:null});vm.runInContext(code,context);assert.equal(context.colorFallback('commons:video','video'),true);context.current={};assert.equal(context.colorFallback('commons:video','video'),false);context.current=null;context.iosVideo=null;assert.equal(context.colorFallback('commons:video','video'),false);
});
test('the Commons iOS route retains the local intro while real media prepares',async()=>{
 const context=vm.createContext({introEnabled:true,iosVideo:{},sources:'commons',BLUENESS_STARTUP:{frames:[{}],image:'fixture'},current:null,Image:class{async decode(){context.decoded=true;}},introFrame:null,introEnded:false,playbackPaused:true,document:{hidden:false},performance:{now:()=>6000},introEndsAt:5000,ctx:{fillRect(){}},canvas:{width:390,height:844}});
 vm.runInContext(flow.slice(flow.indexOf('async function startIntroSequence(){'),flow.indexOf('function pump(){')),context);await context.startIntroSequence();assert.equal(context.decoded,true,'switching source must not remove the intro');
});
test('videos already shown release their stream on iOS and reattach when navigating back',()=>{
 const {context,Video}=environment(),ios=context.iosVideo,media=new Video();ios.attach(media);media.src='https://tunnel.example/__blueness_media/video?url=a';media.paused=false;media.readyState=4;
 ios.park(media);assert.equal(media.src,'');assert.equal(media.paused,true);assert.equal(media.readyState,0);
 ios.park(media);ios.restore(media);assert.equal(media.src,'https://tunnel.example/__blueness_media/video?url=a');assert.equal(media.preload,'auto');
 ios.restore(media);assert.equal(media.src,'https://tunnel.example/__blueness_media/video?url=a');
});
test('select parks the previous iOS video and restores a history entry before seeking',()=>{
 const body=flow.slice(flow.indexOf('function select('),flow.indexOf('function back('));
 assert.match(body,/current\.media\.pause\(\);iosVideo\?\.park\(current\.media\);/);
 assert.ok(body.indexOf('iosVideo?.restore(current.media)')<body.indexOf('current.media.currentTime=current.startTime'));
});
