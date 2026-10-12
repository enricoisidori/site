export function setupLoading(state) {
  const overlay=document.createElement('aside');
  overlay.id='loading'; overlay.setAttribute('aria-label','Caricamento');
  overlay.innerHTML='<div class="loading-footer">loading.</div>';
  document.body.append(overlay);
  let dots=0;
  const timer=setInterval(()=>{
    overlay.firstElementChild.textContent='loading'+'.'.repeat(1+dots++%3);
    if(state.current || state.phase==='error') {
      overlay.remove(); clearInterval(timer);
    }
  },450);
}
