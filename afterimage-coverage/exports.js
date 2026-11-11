import { historyState, hydrateFrames, chainText, download, successfulLinks, exportRecords } from './history.js';
import { highlightParts } from './terms.js';
import { buildAfterimagePDF } from './pdf.js';
export const exportOptions={shape:"vertical"};
let busy=false;
export async function copyChain(){const text=chainText();try{await navigator.clipboard.writeText(text);}catch{const field=document.querySelector('#chainCopy');field.value=text;field.hidden=false;field.focus();field.select();}}
const termFor=record=>record.successor?.matchTerms?.[0]||record.queries?.at(-1)?.term||'';
async function bitmap(preview){if(!preview)return null;try{return await createImageBitmap(await (await fetch(preview)).blob());}catch{return null;}}
function textBlock(ctx,text,terms,x,y,width,texts){
 const words=String(text||'').split(/(\s+)/);let line='',lines=[];
 for(const word of words){if(ctx.measureText(line+word).width>width&&line){lines.push(line.trim());line=word;}else line+=word;}if(line)lines.push(line.trim());
 for(const line of lines.slice(0,5)){let px=x;for(const part of highlightParts(line,terms)){texts.push({text:part.text,x:px,y,size:16,underline:part.match});const length=ctx.measureText(part.text).width;texts[texts.length-1].width=length;px+=length;}y+=24;}return y;
}
async function frame(ctx,record,y){const image=await bitmap(record?.frame?.preview);if(image){const ratio=Math.min(608/image.width,190/image.height);ctx.drawImage(image,(720-image.width*ratio)/2,y+(190-image.height*ratio)/2,image.width*ratio,image.height*ratio);image.close();}else ctx.fillText('frame non disponibile',56,y+110);}
export async function exportChainPDF(shape=exportOptions.shape){
 if(busy)return;busy=true;
 try{
  await hydrateFrames();const links=successfulLinks().filter(link=>link.record.frame?.preview&&link.next.frame?.preview);if(!links.length)throw Error('nessun collegamento mostrato con entrambi i frame disponibili');const pages=[];
  for(const {record,next,terms} of links){
   const texts=[];
   const c=document.createElement('canvas');c.width=720;c.height=shape==='square'?720:1000;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.font='16px Helvetica, Arial, sans-serif';
   await frame(ctx,record,24);textBlock(ctx,record.description||'descrizione in attesa',terms,56,244,608,texts);
   const lower=shape==='square'?350:530;await frame(ctx,next,lower);
   textBlock(ctx,record.successor?.title||'successore in attesa',terms,56,lower+250,608,texts);
   const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.78));pages.push({blob,texts,w:c.width,h:c.height,source:record.video.source,nextSource:record.successor?.source});c.width=c.height=0;await new Promise(resolve=>setTimeout(resolve,0));
  }
  const now=new Date(),pad=n=>String(n).padStart(2,'0'),stamp=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const blob=await buildAfterimagePDF(pages,{title:'afterimage '+stamp.replace('_',' ')});download(blob,`afterimage_${stamp}.pdf`);
 }finally{busy=false;}
}
let excelReady;
function loadExcel(){if(!excelReady)excelReady=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';script.onload=()=>resolve(window.ExcelJS);script.onerror=()=>{excelReady=null;reject(Error('libreria Excel non disponibile'));};document.head.append(script);});return excelReady;}
export async function exportChainExcel(){
 if(busy)return;busy=true;
 try{
  await hydrateFrames();const records=exportRecords();if(!records.length)throw Error('nessun collegamento mostrato da esportare');const ExcelJS=await loadExcel(),book=new ExcelJS.Workbook();book.creator='Enrico Isidori';const sheet=book.addWorksheet('catena');
  const headers=['n','frame analizzato','data visione','titolo','descrizione del frame','keyword scelta','collezioni','soggetti','autore','data fonte','licenza','fonte','successore','fonte successore','tipo passaggio','query','tempo frame (s)'];
  sheet.columns=headers.map((header,i)=>({header,key:String(i),width:i===1?25:[4,12,15].includes(i)?48:27}));sheet.views=[{state:'frozen',ySplit:1}];
  records.forEach((r,i)=>{
   const row=sheet.addRow([i+1,'',new Date(r.at),r.video.title,r.description,termFor(r),(r.video.collections||[r.video.collection]).join(' · '),r.video.subject||'',r.video.creator||'',r.video.date||'',r.video.license||'',{text:r.video.source,hyperlink:r.video.source},r.successor?.title||'',r.successor?{text:r.successor.source,hyperlink:r.successor.source}:'',r.successor?.reason||r.reason,r.successor?.query||r.queries.at(-1)?.query||'',r.frame?.time??null]);
   row.height=105;row.eachCell(cell=>{cell.font={name:'Helvetica',size:11,bold:false};cell.alignment={vertical:'top',wrapText:true};});row.getCell(3).numFmt='dd/mm/yyyy hh:mm';
   if(r.frame?.preview){const id=book.addImage({base64:r.frame.preview,extension:'jpeg'}),ratio=Math.min(166/(r.frame.width||166),90/(r.frame.height||90));sheet.addImage(id,{tl:{col:1.08,row:i+1.08},ext:{width:(r.frame.width||166)*ratio,height:(r.frame.height||90)*ratio},editAs:'oneCell'});}
  });
  sheet.getRow(1).eachCell(c=>{c.font={name:'Helvetica',size:11,bold:false};});sheet.autoFilter={from:'A1',to:'Q'+(records.length+1)};
  download(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'afterimage.xlsx');
 }finally{busy=false;}
}
