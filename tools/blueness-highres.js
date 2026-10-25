// Dormant until A+G. Only one large image is decoded at a time by the exporter.
async function resolveStillsHighRes(record,{signal,onStatus=()=>{}}={}){
 const fallback=async reason=>({image:await createImageBitmap(await record.blob),highRes:false,reason});
 const source=record.source;
 if(!source)return fallback('sorgente non disponibile');
 try{
  signal?.throwIfAborted();onStatus('ricerca immagine ad alta risoluzione');let url;
  const bounded=()=>AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)]);
  if(source.provider==='commons'){
   const params=new URLSearchParams({action:'query',format:'json',origin:'*',prop:'imageinfo',titles:source.title,iiprop:'url|size',iiurlwidth:'1920'});
   const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{signal:bounded()});if(!response.ok)throw Error('Commons non disponibile');
   const data=await response.json(),info=Object.values(data.query?.pages||{})[0]?.imageinfo?.[0];
   url=info?.thumburl||info?.url;
   if(!url||!new URL(url).hostname.endsWith('.wikimedia.org'))throw Error('immagine equivalente non disponibile');
  }else if(source.provider==='archive'){
   const response=await fetch('https://archive.org/metadata/'+encodeURIComponent(source.id),{signal:bounded()});if(!response.ok)throw Error('Archive non disponibile');
   const data=await response.json(),files=data.files||[],byName=new Map(files.map(file=>[file.name,file]));
   const raster=file=>file&&!file.private&&/\.(jpe?g|png|webp)$/i.test(file.name)&&!/^__ia_thumb\./i.test(file.name)&&Number(file.size)>0&&Number(file.size)<=32*1024*1024;
   let original=byName.get('__ia_thumb.jpg');const visited=new Set();
   while(original?.original&&!visited.has(original.name)){visited.add(original.name);original=byName.get(original.original);}
   const originals=files.filter(file=>file.source==='original'&&raster(file));
   const candidate=raster(original)?original:originals.length===1?originals[0]:null;
   if(!candidate)throw Error('nessun originale identificabile con certezza');
   url='https://archive.org/cors/'+encodeURIComponent(source.id)+'/'+candidate.name.split('/').map(encodeURIComponent).join('/');
  }
  if(!url)throw Error('sorgente non disponibile');
  onStatus('caricamento immagine ad alta risoluzione');
  const response=await fetch(url,{signal:bounded()});if(!response.ok)throw Error('immagine non disponibile');
  const blob=await response.blob();if(blob.size>32*1024*1024)throw Error('immagine troppo pesante');
  const image=await createImageBitmap(blob);let reference;
  try{
   reference=await createImageBitmap(await record.blob);
   if(image.width<=reference.width&&image.height<=reference.height)throw Error('sorgente non più grande della miniatura');
   if(Math.abs((image.width/image.height)/(reference.width/reference.height)-1)>.025)throw Error('inquadratura diversa dalla miniatura');
   // Verify that Archive's unique original really represents this thumbnail.
   // This also rejects generic covers/placeholders or unexpected crop variants.
   const c=document.createElement('canvas');c.width=c.height=24;const ctx=c.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(reference,0,0,24,24);const a=ctx.getImageData(0,0,24,24).data;
   ctx.clearRect(0,0,24,24);ctx.drawImage(image,0,0,24,24);const b=ctx.getImageData(0,0,24,24).data;let difference=0;
   for(let i=0;i<a.length;i+=4)difference+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
   if(difference/(24*24*3*255)>.12)throw Error('originale non equivalente alla miniatura');
   return {image,highRes:true};
  }catch(error){image.close();throw error;}finally{reference?.close();}
 }catch(error){if(signal?.aborted)throw signal.reason;return fallback(error.message);}
}
