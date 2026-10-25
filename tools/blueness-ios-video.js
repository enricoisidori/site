// Only iPhone/iPad use this path. Desktop keeps detached, paused preparation.
function createBluenessIOSVideo(){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(!ios)return null;
 const videos=new Set(),blocked=new Set();let button;
 function feedback(){
  if(!button){button=document.createElement('button');button.textContent='tocca per avviare i video';button.setAttribute('aria-label','avvia video');button.style.cssText='position:fixed;z-index:30;left:50%;bottom:24px;transform:translateX(-50%);padding:12px;background:#000b;color:white;font:14px Helvetica,Arial,sans-serif;';button.onclick=unlock;document.body.append(button);}
  button.hidden=!blocked.size;
 }
 function attempt(media){
  // Called synchronously from the tap too, before any await or timer.
  let result;try{result=media.play();}catch(error){result=Promise.reject(error);}
  return Promise.resolve(result).then(()=>{blocked.delete(media);if(button)feedback();},error=>{
   if(error.name==='NotAllowedError'){blocked.add(media);feedback();return;}
   throw error;
  });
 }
 function unlock(){for(const media of [...blocked])void attempt(media).catch(()=>{});}
 function attach(media){
  media.muted=media.defaultMuted=true;media.playsInline=true;media.autoplay=true;
  for(const name of ['muted','playsinline','webkit-playsinline','autoplay'])media.setAttribute(name,'');
  // Onscreen and in the DOM; the opaque stage covers this decoding surface.
  media.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;pointer-events:none;';
  document.body.prepend(media);videos.add(media);
 }
 function start(media){return attempt(media);}
 function release(media){blocked.delete(media);videos.delete(media);media.remove();if(button)feedback();}
 addEventListener('pagehide',event=>{for(const media of videos){media.pause();if(!event.persisted){media.removeAttribute('src');media.load();}}if(!event.persisted)blocked.clear();if(button)button.hidden=true;});
 return {attach,start,play:attempt,release,canPlay:variant=>!!document.createElement('video').canPlayType(variant.type||(/\.mp4(?:[?#]|$)/i.test(variant.src)?'video/mp4':'video/webm'))};
}
