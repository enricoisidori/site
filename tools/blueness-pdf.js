// Tiny image-only PDF writer. Called only after the user requests an export.
async function buildBluenessPDF(pages){
 const encode=text=>new TextEncoder().encode(text),objects=[null,null,null],pageRefs=[];
 const escape=text=>String(text||'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]/g,' ');
 const add=chunks=>{objects.push(chunks.map(c=>typeof c==='string'?encode(c):c));return objects.length-1;};
 for(const page of pages){
  const data=new Uint8Array(await page.blob.arrayBuffer());
  const image=add([`<< /Type /XObject /Subtype /Image /Width ${page.w} /Height ${page.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,data,'\nendstream']);
  const width=960,height=+(page.aspectRatio?width/page.aspectRatio:width*page.h/page.w).toFixed(3),scale=Math.min(width/page.w,height/page.h),iw=page.w*scale,ih=page.h*scale,commands=`0 g 0 0 ${width} ${height} re f\nq ${iw} 0 0 ${ih} ${(width-iw)/2} ${(height-ih)/2} cm /Im0 Do Q\n`;
  const content=add([`<< /Length ${encode(commands).length} >>\nstream\n${commands}endstream`]);
  const link=page.source?` /Annots [<< /Type /Annot /Subtype /Link /Rect [0 0 ${width} ${height}] /Border [0 0 0] /A << /S /URI /URI (${escape(page.source)}) >> >>]`:'';
  pageRefs.push(add([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R${link} >>`]));
 }
 objects[1]=[encode('<< /Type /Catalog /Pages 2 0 R >>')];objects[2]=[encode(`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(n=>n+' 0 R').join(' ')}] >>`)];
 const info=add(['<< /Title (Blueness) /Author (Enrico Isidori x Contento360) /Subject (Session route: one frame per video and final square mosaic) >>']);
 const chunks=[encode('%PDF-1.4\n%Blueness\n')],offsets=[0];let offset=chunks[0].length;
 for(let i=1;i<objects.length;i++){offsets[i]=offset;const parts=[encode(i+' 0 obj\n'),...objects[i],encode('\nendobj\n')];for(const part of parts){chunks.push(part);offset+=part.length;}}
 const xref=offset;chunks.push(encode(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
 return new Blob(chunks,{type:'application/pdf'});
}
