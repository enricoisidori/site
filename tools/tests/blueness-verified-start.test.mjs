import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../blue-flow.js',import.meta.url),'utf8');
const defaults={size:50,hue:25,redMax:40,greenMax:65,saturation:55,brightness:45,rgbDistance:210,disturbance:20,minZoom:.5,maxZoom:8};
const prepare=source.slice(source.indexOf('async function prepare('),source.indexOf('function paintIntroFrame('));
test('fresh image starts immediately after validation without waiting for second image or intro timer',async()=>{
 const fresh=[0,1].map(id=>({kind:'image',provider:'archive',source:'https://archive.org/details/fresh-'+id,url:'https://archive.org/cors/fresh-'+id+'/__ia_thumb.jpg'})),paints=[],pool={loading:2,archiveLoading:0,loaded:0,loadMs:0,analysisMs:0,checked:0,accepted:0,discarded:0,ready:[],failures:0};
 const context=vm.createContext({defaults,settings:{...defaults},baseStills:true,stills:true,revision:0,current:null,lastError:'',checked:0,accepted:0,playbackPaused:false,pools:{image:pool},startupTiming:{loadedAt:null,readyAt:null},played:new Set(),contentSeen:new Set(),performance,mediaKey:item=>item.source,recordCandidate(){},release(){},pump(){},imageFingerprint:media=>media.src,detect(){return {x:50,y:50,w:160,h:100,side:20,zoom:2.5,ratio:1};},waitEvent:media=>new Promise(resolve=>{media.onload=resolve;}),document:{createElement(){return {naturalWidth:160,naturalHeight:100,async decode(){},set src(url){this.url=url;setTimeout(()=>this.onload(),url===fresh[0].url?5:60);},get src(){return this.url;}};}},advance(){const entry=pool.ready.shift();context.current=entry;paints.push({at:performance.now(),source:entry.source});}});
 vm.runInContext(prepare,context);
 const started=performance.now(),first=context.prepare(fresh[0]),second=context.prepare(fresh[1]);
 await first;
 assert.equal(paints.length,1,'first displayed while second is still downloading');
 assert.equal(pool.ready.length,0);assert.equal(context.checked,1,'first result is freshly verified');
 assert.ok(paints[0].at-started<1000,'no five-second gate');
 await second;assert.equal(pool.ready.length,1);assert.equal(pool.failures,0);assert.equal(context.checked,2);
 assert.equal(paints[0].source,fresh[0].source);
});
test('initialization sends one live search before controls or intro setup, with blue candidates and no seeded photos',()=>{
 const requests=[],created=[],steps=[],controls={};
 const document={body:{dataset:{project:'stills',mode:'image',sources:'archive'}},querySelector:selector=>selector==='#stage'?{getContext:()=>({})}:controls,createElement:kind=>{created.push(kind);return {getContext:()=>({})};}};
 const context=vm.createContext({document,localStorage:{getItem:key=>{steps.push(key);return null;},length:0},addEventListener(){},URL,URLSearchParams,AbortSignal,performance,location:{href:'https://example.test/blueness-image/index.html'},window:{},BLUENESS_CATALOG:[],archiveJSON:(url)=>{steps.push('search');requests.push(new URL(url));return new Promise(()=>{});}});
 const functions=source.slice(source.indexOf('function colorFallback('),source.indexOf('async function prepare('));
 const bootstrap=source.slice(0,source.indexOf('const recording='))+functions+'window.initialSnapshot={started:startupTiming.searchAt,queued:pools.image.urls.length};})();';
 vm.runInContext(bootstrap,context);
 assert.equal(requests.length,1);assert.ok(requests[0].searchParams.get('q').includes('AND subject:blue'));
 assert.deepEqual(created,['canvas']);assert.equal(context.window.initialSnapshot.queued,0);
 assert.ok(context.window.initialSnapshot.started!==null);
 assert.ok(steps.indexOf('search')<steps.indexOf('blue-played-v1'),'network starts before scanning playback history');
 assert.ok(!source.includes('startupCandidate'),'no list landing or local bridge remains');
});
test('video Archive queries explicitly exclude Capitol Hill and Capitol Attack subjects',async()=>{
 let query;const code=source.slice(source.indexOf('async function fetchArchive('),source.indexOf('function useLightVideo('));
 const context=vm.createContext({colorFallback:()=>false,stills:false,baseStills:false,Math,URLSearchParams,AbortSignal,totals:new Map(),archiveJSON:async url=>{query=new URL(url).searchParams.get('q');return {response:{docs:[]}};}});
 vm.runInContext(code,context);await context.fetchArchive('video');
 assert.ok(query.includes('AND NOT subject:"Capitol Hill"'));assert.ok(query.includes('AND NOT subject:"January 6 Capitol Attack"'));
});
