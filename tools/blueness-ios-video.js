// Only iPhone/iPad use this path. Desktop keeps detached, paused preparation.
function createBluenessIOSVideo(){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(!ios)return null;
 const videos=new Set(),blocked=new Set();let button,border,active=null,staged=null,stagedKey='',playFrom=0,lastTime=0,lastProgress=0,lastRetry=0,retries=0,presentation='';
 const parked='position:fixed;left:0;top:0;width:2px;height:2px;pointer-events:none;';
 let relayConnection;
 async function mediaURL(url){
  // Safari on the device rejects pixel readback even with Commons CORS.
  // Stream the public bytes through this page's origin, preserving Range.
  relayConnection ||= fetch(new URL('/__blueness_media/status',location.href),{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(2500)}).then(async response=>{
   if(!response.ok)throw Error('relay assente');const status=await response.json();if(status.service!=='blueness-range-relay')throw Error('relay assente');
  }).catch(()=>{throw Error('streaming mobile non attivo: relay /__blueness_media assente su questo dominio');});
  await relayConnection;const target=new URL('/__blueness_media/video',location.href);target.searchParams.set('url',url);return target.href;
 }
 // Shown only when Safari actually needs a gesture. The whole screen is the
 // target; the same tap also turns the sound on.
 function feedback(){
  if(!button){
   button=document.createElement('button');button.setAttribute('aria-label','tocca per avviare i video con audio');
   button.style.cssText='position:fixed;inset:0;z-index:30;display:flex;align-items:flex-end;justify-content:center;padding:0 0 24px;margin:0;border:0;background:transparent;color:#0000ff;font:bold 19px "Times New Roman",Times,serif;letter-spacing:.02em;cursor:pointer;-webkit-tap-highlight-color:transparent;';
   button.textContent='CLICK EVERYWHERE';button.onclick=unlock;document.body.append(button);
  }
  button.hidden=!blocked.size;
 }
 function attempt(media){
  // Called synchronously from the tap too, before any await or timer.
  let result;try{result=media.play();}catch(error){result=Promise.reject(error);}
  return Promise.resolve(result).then(()=>{blocked.delete(media);if(button)feedback();},error=>{
   // Sound without a fresh gesture can be refused: keep the chain going muted.
   if(error.name==='NotAllowedError'&&videos.has(media)&&!media.muted){media.muted=true;return attempt(media);}
   if(error.name==='NotAllowedError'&&videos.has(media)){blocked.add(media);feedback();return;}
   throw error;
  });
 }
 function unlock(){
  const media=active&&blocked.has(active)?active:[...blocked][0];if(!media)return;
  lastProgress=performance.now();retries=0;media.pause();api.onGesture?.(media);void attempt(media).catch(()=>{});
 }
 function attach(media){
  media.muted=media.defaultMuted=true;media.playsInline=true;media.autoplay=false;media.removeAttribute('autoplay');
  media.crossOrigin='anonymous';media.setAttribute('crossorigin','anonymous');
  // Use explicit play(), not viewport-dependent declarative autoplay: the
  // canvas covers this decoding surface, which Safari may treat as occluded.
  for(const name of ['muted','playsinline','webkit-playsinline'])media.setAttribute(name,'');
  // Onscreen and in the DOM; the opaque stage covers this decoding surface.
  media.style.cssText=parked;
  document.body.prepend(media);videos.add(media);
 }
 function start(media){return attempt(media);}
 function play(media){if(active!==media){if(active)active.style.cssText=parked;active=media;presentation=staged===media?stagedKey:'';if(staged===media)staged=null;if(border)border.hidden=true;}playFrom=lastTime=media.currentTime;lastProgress=performance.now();lastRetry=-Infinity;retries=0;return attempt(media);}
 // Same geometry as drawScreen's full-image layer.
 function geometry(m,screen){
  const {x,y,w,h}=screen,cx=x+w/2,cy=y+h/2,left=cx-m.x*m.zoom,top=cy-m.y*m.zoom,width=m.w*m.zoom,height=m.h*m.zoom;
  return {cx,cy,key:[left,top,width,height,x,y,w,h].join(':'),css:`position:fixed;pointer-events:none;max-width:none;max-height:none;object-fit:fill;left:${left}px;top:${top}px;width:${width}px;height:${height}px;clip-path:inset(${Math.max(0,y-top)}px ${Math.max(0,left+width-x-w)}px ${Math.max(0,top+height-y-h)}px ${Math.max(0,x-left)}px);`};
 }
 // The next ready video already waits at its final size and position,
 // invisible: switching only makes it visible, it is never resized on screen.
 function stage(entry,screen,enabled){
  const media=entry?.media;
  if(!enabled||!media||media===active||!entry.match||!videos.has(media)){if(staged&&staged!==active)staged.style.cssText=parked;staged=null;stagedKey='';return;}
  if(staged&&staged!==media&&staged!==active)staged.style.cssText=parked;
  const g=geometry(entry.match,screen);
  if(staged!==media||stagedKey!==g.key){media.style.cssText=g.css+'z-index:1;opacity:0;';staged=media;stagedKey=g.key;}
 }
 function present(entry,screen,size,enabled){
  const m=entry?.match;
  if(!active||entry?.media!==active||!m||!enabled){if(active&&presentation){active.style.cssText=parked;presentation='';}if(border)border.hidden=true;return false;}
  // Visible at once (a tap must respond immediately): ready videos are already
  // parked on their verified, decoded frame and staged at their final geometry.
  const painting=active.readyState>=2,g=geometry(m,screen);
  if(g.key!==presentation){active.style.cssText=g.css+'z-index:2;opacity:'+(painting?1:0)+';';presentation=g.key;}
  else if(painting&&active.style.opacity!=='1'){active.style.zIndex='2';active.style.opacity='1';}
  if(!border){border=document.createElement('div');border.style.cssText='position:fixed;z-index:2;pointer-events:none;box-sizing:border-box;border:1px solid white;';document.body.append(border);}
  Object.assign(border.style,{left:Math.round(g.cx-size/2)+'px',top:Math.round(g.cy-size/2)+'px',width:size+1+'px',height:size+1+'px'});border.hidden=!painting||!!entry.hideIntroBorder;
  return painting;
 }
 function tick(media){
  if(media!==active||document.hidden||media.ended||media.seeking)return;
  const now=performance.now();
  if(Math.abs(media.currentTime-lastTime)>.001){lastTime=media.currentTime;lastProgress=now;retries=0;}
  // Safari may pause the active decoder when another inline video warms up.
  // Retry only the selected media, only during running playback, and bound it.
  if(media.paused&&!blocked.has(media)&&now-lastRetry>=1000){
   if(retries>=4)return;
   retries++;lastRetry=now;void attempt(media).catch(()=>{});
  }
 }
 // A paused element keeps its network stream and decoder alive on iOS. Videos
 // already shown are detached, then reattached only when navigating back.
 const sources=new WeakMap();
 function park(media){if(!media.src)return;sources.set(media,media.src);media.pause();media.removeAttribute('src');media.load();blocked.delete(media);if(button)feedback();}
 function restore(media){const src=sources.get(media);if(!src||media.src)return;sources.delete(media);media.preload='auto';media.src=src;}
 function stalledFor(media){return media===active&&!media.paused&&!document.hidden?performance.now()-lastProgress:0;}
 function release(media){if(staged===media){staged=null;stagedKey='';}if(active===media){active=null;presentation='';if(border)border.hidden=true;}blocked.delete(media);videos.delete(media);media.remove();if(button)feedback();}
 // Any tap turns the sound on for the current video; the gesture also starts
 // playback if Safari refused it.
 function gesture(){if(blocked.size){unlock();return;}if(active&&active.muted&&api.onGesture){api.onGesture(active);void attempt(active).catch(()=>{});}}
 addEventListener('click',gesture,true);
 addEventListener('pagehide',event=>{for(const media of videos){media.pause();if(!event.persisted){media.removeAttribute('src');media.load();}}if(!event.persisted)blocked.clear();if(button)button.hidden=true;});
 const api={attach,start,play,park,restore,stage,present,tick,stalledFor,release,mediaURL,get status(){return active?{renderer:presentation?'native':'canvas',paused:active.paused,time:active.currentTime,readyState:active.readyState,networkState:active.networkState,error:active.error?.message||'',waitingForTap:blocked.has(active),retries,stalledMs:Math.round(performance.now()-lastProgress)}:null;},canPlay:variant=>!!document.createElement('video').canPlayType(variant.type||(/\.mp4(?:[?#]|$)/i.test(variant.src)?'video/mp4':'video/webm'))};
 return api;
}
