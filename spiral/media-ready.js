export function bufferedAhead(video) {
  for(let i=0;i<video.buffered.length;i++) {
    if(video.buffered.start(i)<=video.currentTime+.1 && video.buffered.end(i)>video.currentTime) return video.buffered.end(i)-video.currentTime;
  }
  return 0;
}
export function readyForCut(video) {
  const remaining=video.duration-video.currentTime;
  return video.readyState>=3 && Number.isFinite(remaining) && remaining>0 && bufferedAhead(video)>=Math.min(2,Math.max(0,remaining-.1));
}
export function contentKey(hash) { return !hash ? null : hash.startsWith('md5:') ? hash : `sha256:${hash}`; }
