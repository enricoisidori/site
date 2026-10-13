// Tiny PDF writer with native selectable Helvetica text. Called only after the user requests an export.
export async function buildAfterimagePDF(pages){
 const encode=text=>new TextEncoder().encode(text),objects=[null,null,null],pageRefs=[];
 const escape=text=>String(text||'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]/g,' ');
 const add=chunks=>{objects.push(chunks.map(c=>typeof c==='string'?encode(c):c));return objects.length-1;};
 const font=add(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
 const extra='€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
 const codes=[128,130,131,132,133,134,135,136,137,138,139,140,142,145,146,147,148,149,150,151,152,153,154,155,156,158,159];
 const hex=text=>Array.from(String(text),ch=>{const code=ch.codePointAt(0),i=extra.indexOf(ch);return (code<=255?code:i>=0?codes[i]:63).toString(16).padStart(2,'0');}).join('');
 for(const page of pages){
  const data=new Uint8Array(await page.blob.arrayBuffer());
  const image=add([`<< /Type /XObject /Subtype /Image /Width ${page.w} /Height ${page.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,data,'\nendstream']);
  const width=960,height=+(width*page.h/page.w).toFixed(3),scale=width/page.w,commands=`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`+(page.texts||[]).map(t=>`BT /F1 ${t.size*scale} Tf 0 g 1 0 0 1 ${t.x*scale} ${height-t.y*scale} Tm <${hex(t.text)}> Tj ET\n`+(t.underline?`0 G ${scale} w ${t.x*scale} ${height-(t.y+3)*scale} m ${(t.x+t.width)*scale} ${height-(t.y+3)*scale} l S\n`:'')).join('');
  const content=add([`<< /Length ${encode(commands).length} >>\nstream\n${commands}endstream`]);
  const links=[[page.source,height/2,height],[page.nextSource,0,height/2]].filter(([source])=>source);
  const link=links.length?' /Annots ['+links.map(([source,low,high])=>`<< /Type /Annot /Subtype /Link /Rect [0 ${low} ${width} ${high}] /Border [0 0 0] /A << /S /URI /URI (${escape(source)}) >> >>`).join(' ')+']':'';
  pageRefs.push(add([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R${link} >>`]));
 }
 objects[1]=[encode('<< /Type /Catalog /Pages 2 0 R >>')];objects[2]=[encode(`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(n=>n+' 0 R').join(' ')}] >>`)];
 const info=add(['<< /Title (afterimage) /Author (Enrico Isidori) /Subject (Description and keyword chain) >>']);
 const chunks=[encode('%PDF-1.4\n%afterimage\n')],offsets=[0];let offset=chunks[0].length;
 for(let i=1;i<objects.length;i++){offsets[i]=offset;const parts=[encode(i+' 0 obj\n'),...objects[i],encode('\nendobj\n')];for(const part of parts){chunks.push(part);offset+=part.length;}}
 const xref=offset;chunks.push(encode(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
 return new Blob(chunks,{type:'application/pdf'});
}
