// ISO BMFF: require an audio handler inside a media track, not a filename guess.
export function hasAudioTrack(buffer) {
  const view=new DataView(buffer);
  const type=at=>String.fromCharCode(...new Uint8Array(buffer,at,4));
  function walk(start,end,media=false) {
    for(let at=start;at+8<=end;) {
      let size=view.getUint32(at); let header=8;
      if(size===1) { if(at+16>end)return false; size=Number(view.getBigUint64(at+8));header=16; }
      if(size===0)size=end-at;
      if(size<header || at+size>end)return false;
      const name=type(at+4), payload=at+header;
      if(name==='hdlr' && media && size>=header+12 && type(payload+8)==='soun')return true;
      if(['moov','trak','mdia'].includes(name) && walk(payload,at+size,name==='mdia'))return true;
      at+=size;
    }
    return false;
  }
  return walk(0,buffer.byteLength);
}
export function isDarkFrame(pixels) {
  let dark=0,total=0,sum=0;
  for(let i=0;i<pixels.length;i+=4) {
    const y=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
    total++;sum+=y;if(y<28)dark++;
  }
  return total>0 && sum/total<14 && dark/total>=.95;
}
export async function validateDarkVideo(video,blob,seek) {
  if(!hasAudioTrack(await blob.arrayBuffer()))throw new Error('Darkroom: nessuna traccia audio nel file');
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=54;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  // Samples throughout the source, not just its opening black frame.
  for(let i=0;i<12;i++) {
    await seek(Math.min(video.duration-.05,video.duration*(i+.5)/12));
    ctx.drawImage(video,0,0,96,54);
    if(!isDarkFrame(ctx.getImageData(0,0,96,54).data))throw new Error('Darkroom: video non sufficientemente nero');
  }
}
