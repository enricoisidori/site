// Only iPhone/iPad use this path. Desktop keeps detached, paused preparation.
function createBluenessIOSVideo(){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(!ios)return null;
 const videos=new Set(),blocked=new Set();let button,border,active=null,lastTime=0,lastProgress=0,lastRetry=0,retries=0,presentation='';
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
 function feedback(){
  if(!button){button=document.createElement('button');button.textContent='tocca per avviare i video';button.setAttribute('aria-label','avvia video');button.style.cssText='position:fixed;z-index:30;left:50%;bottom:24px;transform:translateX(-50%);padding:12px;background:#000b;color:white;font:14px Helvetica,Arial,sans-serif;';button.onclick=unlock;document.body.append(button);}
  button.hidden=!blocked.size;
 }
 function attempt(media){
  // Called synchronously from the tap too, before any await or timer.
  let result;try{result=media.play();}catch(error){result=Promise.reject(error);}
  return Promise.resolve(result).then(()=>{blocked.delete(media);if(button)feedback();},error=>{
   if(error.name==='NotAllowedError'&&videos.has(media)){blocked.add(media);feedback();return;}
   throw error;
  });
 }
 function unlock(){
  const media=active&&blocked.has(active)?active:[...blocked][0];if(!media)return;
  lastProgress=performance.now();retries=0;media.pause();void attempt(media).catch(()=>{});
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
 function play(media){if(active!==media){if(active)active.style.cssText=parked;active=media;presentation='';if(border)border.hidden=true;}lastTime=media.currentTime;lastProgress=performance.now();lastRetry=-Infinity;retries=0;return attempt(media);}
 function present(entry,screen,size,enabled){
  const m=entry?.match;
  if(!active||entry?.media!==active||!m||!enabled){if(active&&presentation){active.style.cssText=parked;presentation='';}if(border)border.hidden=true;return false;}
  const {x,y,w,h}=screen,cx=x+w/2,cy=y+h/2,left=cx-m.x*m.zoom,top=cy-m.y*m.zoom,width=m.w*m.zoom,height=m.h*m.zoom;
  const key=[left,top,width,height,x,y,w,h,size,!!entry.hideIntroBorder].join(':');
  if(key!==presentation){
   // The selected video is actually visible to WebKit's native compositor.
   // Its geometry is identical to drawScreen's full-image layer.
   active.style.cssText=`position:fixed;z-index:2;pointer-events:none;max-width:none;max-height:none;object-fit:fill;left:${left}px;top:${top}px;width:${width}px;height:${height}px;clip-path:inset(${Math.max(0,y-top)}px ${Math.max(0,left+width-x-w)}px ${Math.max(0,top+height-y-h)}px ${Math.max(0,x-left)}px);`;
   if(!border){border=document.createElement('div');border.style.cssText='position:fixed;z-index:2;pointer-events:none;box-sizing:border-box;border:1px solid white;';document.body.append(border);}
   Object.assign(border.style,{left:Math.round(cx-size/2)+'px',top:Math.round(cy-size/2)+'px',width:size+1+'px',height:size+1+'px'});border.hidden=!!entry.hideIntroBorder;presentation=key;
  }
  return true;
 }
 function tick(media){
  if(media!==active||document.hidden||media.ended||media.seeking)return;
  const now=performance.now();
  if(Math.abs(media.currentTime-lastTime)>.001){lastTime=media.currentTime;lastProgress=now;retries=0;}
  if(now-lastProgress>=4000&&!blocked.has(media)){blocked.add(media);feedback();}
  // Safari may pause the active decoder when another inline video warms up.
  // Retry only the selected media, only during running playback, and bound it.
  if(media.paused&&!blocked.has(media)&&now-lastRetry>=1000){
   if(retries>=2){blocked.add(media);feedback();return;}
   retries++;lastRetry=now;void attempt(media).catch(()=>{if(videos.has(media)){blocked.add(media);feedback();}});
  }
 }
 // A paused element keeps its network stream and decoder alive on iOS. Videos
 // already shown are detached, then reattached only when navigating back.
 const sources=new WeakMap();
 function park(media){if(!media.src)return;sources.set(media,media.src);media.pause();media.removeAttribute('src');media.load();blocked.delete(media);if(button)feedback();}
 function restore(media){const src=sources.get(media);if(!src||media.src)return;sources.delete(media);media.preload='auto';media.src=src;}
 function release(media){if(active===media){active=null;presentation='';if(border)border.hidden=true;}blocked.delete(media);videos.delete(media);media.remove();if(button)feedback();}
 addEventListener('pagehide',event=>{for(const media of videos){media.pause();if(!event.persisted){media.removeAttribute('src');media.load();}}if(!event.persisted)blocked.clear();if(button)button.hidden=true;});
 return {attach,start,play,park,restore,present,tick,release,mediaURL,get status(){return active?{renderer:presentation?'native':'canvas',paused:active.paused,time:active.currentTime,readyState:active.readyState,networkState:active.networkState,error:active.error?.message||'',waitingForTap:blocked.has(active),retries,stalledMs:Math.round(performance.now()-lastProgress)}:null;},canPlay:variant=>!!document.createElement('video').canPlayType(variant.type||(/\.mp4(?:[?#]|$)/i.test(variant.src)?'video/mp4':'video/webm'))};
}
