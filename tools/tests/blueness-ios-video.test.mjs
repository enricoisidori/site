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
 const context=vm.createContext({document,navigator:{userAgent:ios?'iPhone':'Macintosh',platform:ios?'iPhone':'MacIntel',maxTouchPoints:ios?5:0},addEventListener:(name,fn)=>events[name]=fn,Event,Promise,setTimeout,clearTimeout,performance});
 vm.runInContext(helper,context);context.iosVideo=context.createBluenessIOSVideo();return {context,nodes,videos,events,Video};
}
test('desktop stays outside the iOS path; touch iPad desktop user agent is recognized',()=>{
 const {context,nodes}=environment(false);assert.equal(context.iosVideo,null);assert.equal(nodes.length,0);
 context.navigator.maxTouchPoints=5;assert.ok(context.createBluenessIOSVideo());
});
test('iOS videos attach inline and muted; rejected autoplay can be retried directly by tapping',async()=>{
 const {context,nodes,Video,events}=environment(),media=new Video(),ios=context.iosVideo;
 ios.attach(media);assert.ok(media.connected);assert.ok(media.muted&&media.defaultMuted&&media.playsInline&&media.autoplay);
 assert.ok(media.attrs.has('playsinline'));assert.ok(!/display:none|visibility:hidden|left:-/.test(media.style.cssText));
 media.allowed=false;await ios.start(media);const button=nodes.find(node=>node.textContent==='tocca per avviare i video');assert.ok(button);assert.equal(button.hidden,false);
 media.allowed=true;button.onclick();assert.equal(media.plays,2,'play called synchronously in the tap');await Promise.resolve();await Promise.resolve();assert.equal(button.hidden,true);
 media.src='fixture.mp4';events.pagehide({persisted:true});assert.equal(media.src,'fixture.mp4','back-forward cache preserves the source');
 events.pagehide({persisted:false});assert.equal(media.src,'');ios.release(media);assert.equal(media.connected,false);
});
test('actual iOS preparation requests playback before loadeddata and parks a verified frame without canplay',async()=>{
 const {context,videos}=environment();let started=0;
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
