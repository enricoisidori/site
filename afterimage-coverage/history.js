import { highlightParts } from './terms.js';
const storageKey=document.title+':chain:v1';
let records=[],current;
export const historyState={records,saved:true,error:''};
try{const data=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(data))records.push(...data.slice(-2000));}catch(error){historyState.saved=false;historyState.error=error.message;}
const frameDB=new Promise(resolve=>{try{const request=indexedDB.open('afterimage-frames',1);request.onupgradeneeded=()=>request.result.createObjectStore('frames');request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);}catch{resolve(null);}});
async function frameStore(key,value){const db=await frameDB;if(!db)return null;return new Promise(resolve=>{const tx=db.transaction('frames',value?'readwrite':'readonly'),store=tx.objectStore('frames'),request=value?store.put(value,key):store.get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);});}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(records,(key,value)=>key==='preview'?undefined:value));historyState.saved=true;historyState.error='';}catch(error){historyState.saved=false;historyState.error=error.message;}}
const videoInfo=item=>({id:item.id,title:item.title,source:item.source,collection:item.collection,collections:item.collections||[],creator:item.creator,subject:item.subject,description:item.description,date:item.date,publisher:item.publisher,license:item.license,filename:item.filename,streamURL:item.streamURL,duration:item.duration,width:item.width,height:item.height,format:item.format,bytes:item.bytes,uploader:item.uploader,contributor:item.contributor});
export function beginChain(item,reason,playStart=0){current={at:new Date().toISOString(),video:videoInfo(item),reason,playStart,shown:true,description:'',keywords:[],queries:[],successor:null};current.frameKey=current.at+':'+item.id;records.push(current);if(records.length>2000)records.splice(0,records.length-2000);persist();}
export function describeChain(caption,keywords,frame){if(!current)return;const needsFrame=frame.preview&&!current.frame?.preview;Object.assign(current,{description:caption,keywords:[...keywords],frame});if(needsFrame)frameStore(current.frameKey,frame.preview);persist();}
export function queryChain(term,query,total=null){if(!current)return;const old=current.queries.at(-1);if(old?.term===term)Object.assign(old,{query,total});else current.queries.push({at:new Date().toISOString(),term,query,total});persist();}
export function finishChain(item,reason){if(!current)return;current.successor={...videoInfo(item),reason,matchTerms:item.incoming?.terms||[],query:item.incoming?.query||''};current.finishedAt=new Date().toISOString();persist();}
export async function hydrateFrames(list=records){await Promise.all(list.map(async r=>{if(!r.frame?.preview&&r.frameKey){const preview=await frameStore(r.frameKey);if(preview)r.frame={...r.frame,preview};}}));return list;}
export function successfulLinks(){
 const result=[];
 for(let i=0;i<records.length-1;i++){
  const record=records[i],next=records[i+1],link=record.successor,terms=link?.matchTerms||[];
  if(record.shown===false||next.shown===false||!link||link.id!==next.video.id||!terms.length)continue;
  const common=terms.filter(term=>highlightParts(record.description||'',[term]).some(p=>p.match)&&highlightParts(next.video.title||'',[term]).some(p=>p.match));
  if(common.length)result.push({record,next,terms:common});
 }
 return result;
}
export function exportRecords(){
 const links=successfulLinks(),included=new Set(links.flatMap(link=>[link.record,link.next])),outgoing=new Map(links.map(link=>[link.record,link]));
 return records.filter(record=>included.has(record)).map(record=>{
  const link=outgoing.get(record);
  return {...record,queries:link?record.queries.filter(query=>link.terms.includes(query.term)):[],successor:link?{...record.successor,matchTerms:link.terms}:null};
 });
}
export function chainText(){return exportRecords().map((r,i)=>[String(i+1)+'. '+r.video.title,r.video.source,'collezioni: '+(r.video.collections||[r.video.collection]).join(' · '),'descrizione: '+r.description,'keyword: '+(r.successor?.matchTerms?.join(' · ')||r.queries.at(-1)?.term||''),...(r.successor?['successivo: '+r.successor.title,r.successor.source,'tipo: '+r.successor.reason]:[])].join('\n')).join('\n\n');}
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function exportChain(){await hydrateFrames();download(new Blob([JSON.stringify({project:document.title,exportedAt:new Date().toISOString(),records:exportRecords()},null,2)],{type:'application/json'}),'afterimage.json');}
hydrateFrames(records.slice(-30));
