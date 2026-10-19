import { recordingControlsHTML } from '../assets/shared/recording/recorder.js';
import { highlightParts } from './terms.js';
import { MAX_PLAY_SECONDS } from './media.js';
import { historyState, exportChain, download } from './history.js';
import { filterState, updateFilters, filterDefaultsCode } from './scope.js';
import { copyChain, exportChainPDF, exportChainExcel, exportOptions } from './exports.js';
const pane=document.querySelector('#info');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const marked=(value,terms)=>highlightParts(value||'',terms).map(p=>p.match?`<u>${esc(p.text)}</u>`:esc(p.text)).join('');
let pdfShape='vertical',lastRender=0;
pane.addEventListener('change',event=>{const el=event.target;if(el.dataset.filter)updateFilters({[el.dataset.filter]:el.checked});if(el.dataset.collection){const set=new Set(filterState.collections);el.checked?set.add(el.dataset.collection):set.delete(el.dataset.collection);updateFilters({collections:[...set]});}if(el.id==='pdfShape')exportOptions.shape=pdfShape=el.value;});
pane.addEventListener('click',async event=>{
 const action=event.target.dataset.action;if(!action)return;
 try{
  if(action==='back'||action==='next')window.dispatchEvent(new CustomEvent('afterimage:navigate',{detail:action==='back'?-1:1}));
  if(action==='fit')window.dispatchEvent(new Event('afterimage:fit'));
  if(action==='copy')await copyChain();if(action==='json')await exportChain();if(action==='pdf')await exportChainPDF(pdfShape);if(action==='excel')await exportChainExcel();
  if(action==='defaults')download(new Blob([filterDefaultsCode()],{type:'text/javascript'}),'filter-defaults.js');
 }catch(error){window.dispatchEvent(new CustomEvent('afterimage:export-error',{detail:error.message}));}
});
export function renderInfo(state,active){
 if(pane.hidden||performance.now()-lastRender<750)return;
 if(pane.contains(document.activeElement)&&document.activeElement.matches('textarea,input,select'))return;
 lastRender=performance.now();
 const open=[...pane.querySelectorAll('details[open]')].map(el=>el.dataset.section),scroll=pane.scrollTop,item=active?.item;
 const records=historyState.records,collections=[...new Set([...filterState.collections,...(item?.collections||[]),...records.slice(-50).flatMap(r=>r.video.collections||[])])];
 pane.innerHTML=`
 <p>${state.paused?'pausa · precaricamento attivo<br>':''}${esc(state.step)} · ${esc(state.modelStatus)}<br>${state.queueSemantic} della query pronti · ${state.queueGeneral} casuali pronti · ${state.loading} in preparazione<br>${esc(state.message)}</p>
 <p class="actions"><button data-action="back">◀</button> <button data-action="next">▶</button> <button data-action="copy">copia catena</button> <button data-action="json">json</button> <button data-action="excel">excel</button> <button data-action="pdf">pdf · p</button></p>
 <p><button data-action="fit">immagine ${esc(state.fitMode)} · cambia fit/fill</button></p>
 ${recordingControlsHTML('afterimage')}
 <select id="pdfShape" aria-label="formato pdf"><option value="vertical" ${pdfShape==='vertical'?'selected':''}>pdf verticale</option><option value="square" ${pdfShape==='square'?'selected':''}>pdf quadrato</option></select>
 <textarea id="chainCopy" hidden readonly aria-label="catena da copiare"></textarea>
 ${item?`<p><a href="${esc(item.source)}" target="_blank" rel="noopener">${marked(item.title,item.incoming?.terms||[])}</a><br>${esc(item.collection||'')} · ${esc(item.creator||'')} · ${esc(item.date||'')}</p>`:''}
 <details data-section="filters"><summary>selezione e filtri</summary><label><input type="checkbox" data-filter="content" ${filterState.content?'checked':''}> esclusioni di contenuto</label><label><input type="checkbox" data-filter="promotional" ${filterState.promotional?'checked':''}> trailer e promozionali</label>${collections.map(id=>`<label><input type="checkbox" data-collection="${esc(id)}" ${filterState.collections.includes(id)?'checked':''}> escludi ${esc(id)}</label>`).join('')}<button data-action="defaults">scarica default per il sito</button><p>le scelte sono conservate nel browser; il file scaricato aggiorna i default pubblicati</p></details>
 <details data-section="current"><summary>informazioni video e ricerca</summary>${item?`<p>${esc(item.description)}<br>collezioni: ${esc(item.collection)}<br>soggetti: ${esc(item.subject)}<br>autore: ${esc(item.creator)} · editore: ${esc(item.publisher)}<br>licenza: ${esc(item.license||'non dichiarata')}<br>file: ${esc(item.filename)} · ${item.width||'?'} × ${item.height||'?'} · ${Math.round((item.bytes||0)/1048576)} mb</p>`:''}<p>${esc(state.query)}<br>${state.checked} metadati verificati · ${(state.buffer||0).toFixed(1)} s buffer · ${(state.elapsed||0).toFixed(0)} / ${MAX_PLAY_SECONDS} s</p></details>
 <div class="chain">${records.slice(-30).map(record=>{
  const terms=record.successor?.matchTerms||[record.queries?.at(-1)?.term].filter(Boolean),preview=record.frame?.preview||(record===records.at(-1)?state.preview:'');
  return `<article>${preview?`<img src="${esc(preview)}" alt="frame usato dal modello">`:''}<p>${marked(record.description||'descrizione in preparazione',terms)}</p>${record.successor?`<p><a href="${esc(record.successor.source)}" target="_blank" rel="noopener">${marked(record.successor.title,terms)}</a>${record.successor.reason!=='query'?'<br>passaggio casuale, senza keyword comune':''}</p>`:''}<details data-section="record-${esc(record.at)}"><summary>contesto</summary><p><a href="${esc(record.video.source)}" target="_blank" rel="noopener">${esc(record.video.title)}</a><br>${esc(record.video.collection||'')}<br>${esc(record.video.subject||'')}<br>${esc(record.queries?.at(-1)?.query||'')}<br>frame ${record.frame?.time?.toFixed(1)||'—'} s · ${esc(record.frame?.source||'')}</p></details></article>`;
 }).join('')}</div>
 <p>${records.length} video registrati · ${historyState.saved?'cronologia salvata':'salvataggio: '+esc(historyState.error)}</p>`;
 for(const id of open)pane.querySelectorAll('details').forEach(el=>{if(el.dataset.section===id)el.open=true;});pane.scrollTop=scroll;
}
export function toggleInfo(){pane.hidden=!pane.hidden;}
