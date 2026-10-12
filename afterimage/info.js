import { highlightParts } from './terms.js';
import { MAX_PLAY_SECONDS } from './media.js';
import { historyState } from './history.js';
const pane = document.querySelector('#info');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const marked = (value, terms) => highlightParts(value || '', terms).map(p => p.match ? `<mark>${esc(p.text)}</mark>` : esc(p.text)).join('');
export function renderInfo(state, active) {
  if (pane.hidden) return;
  const openHistory = !!pane.querySelector('details[open]'), scroll = pane.scrollTop;
  const incoming = active?.item?.incoming, item = active?.item;
  const next = state.next;
  const steps = ['video', 'modello', 'keyword', 'query', 'precaricamento', 'pronto'];
  pane.innerHTML = `
    ${state.preview ? `<img src="${state.preview}" alt="fotogramma analizzato">` : ''}
    <p>${steps.map(s => `<span class="step ${state.step === s ? 'active' : ''}">${s}</span>`).join(' → ')}</p>
    <p><span class="label">video ${state.switches + 1}</span><br>${item ? marked(item.title, incoming?.terms || []) : 'waiting'}</p>
    ${item ? `<p class="small"><a id="sourceLink" href="${esc(item.source)}" target="_blank" rel="noopener">fonte · internet archive</a></p>` : ''}
    ${item ? `<p class="small">collezioni: ${(item.collections || []).map(id => `<a href="https://archive.org/details/${encodeURIComponent(id)}" target="_blank" rel="noopener">${esc(id)}</a>`).join(' · ') || '—'}<br>editore: ${esc(item.publisher || '—')} · aggiunto: ${esc(item.added || '—')}<br>file: ${esc(item.filename)} · ${esc(item.format)} · ${item.width || '?'} × ${item.height || '?'} · ${(item.bytes / 1048576).toFixed(1)} mb · durata sorgente: ${item.duration ? Math.round(item.duration) + ' s' : 'non dichiarata'}<br>diritti / licenza: ${esc(item.license || 'non dichiarati')}</p>` : ''}
    ${incoming ? `<p class="chain"><span class="label">catena in entrata</span><br>video: ${esc(incoming.parentTitle)}<br>↓ descrizione: ${esc(incoming.caption || 'non disponibile')}<br>↓ keyword: <mark>${esc(incoming.terms.join(' · ') || 'nessuna — fallback casuale')}</mark><br>↓ keyword nel titolo: ${incoming.kind === 'query' ? marked(item.title, incoming.terms) : 'nessun match richiesto per il fallback'}<br>↓ video: ${marked(item.title, incoming.terms)}</p>` : ''}
    <p class="chain"><span class="label">catena in uscita</span><br>descrizione: ${esc(state.caption || 'in attesa del modello')}<br>↓ keyword: <mark>${esc(state.selectedTerm || 'in selezione')}</mark><br>↓ keyword nel titolo: ${next ? marked(next.title, next.incoming?.terms || []) : 'ricerca in corso'}<br>↓ video: ${next ? marked(next.title, next.incoming?.terms || []) : 'in preparazione'}</p>
    <p class="small">catena: ${historyState.records.length} video conservati (massimo 2.000) · ${historyState.saved ? 'salvataggio automatico nel browser' : 'salvataggio nel browser non disponibile'} · s esporta json</p>
    <details><summary>cronologia delle catene</summary>${historyState.records.slice(-20).reverse().map(record => `<p class="chain">${esc(record.video.title)}<br>↓ ${esc(record.description || 'descrizione non disponibile')}<br>↓ <mark>${esc(record.successor?.matchTerms?.join(' · ') || record.queries?.at(-1)?.term || '—')}</mark><br>↓ ${record.successor ? marked(record.successor.title, record.successor.matchTerms) : 'in corso'}${record.successor && record.successor.reason !== 'query' ? ' · fallback / cambio casuale' : ''}</p>`).join('')}</details>
    ${item ? `<p><span class="label">archivio</span><br>${esc(item.collection || 'collezione non dichiarata')}<br><span class="small">id ${esc(item.identifier)}${item.creator ? ` · autore ${esc(item.creator)}` : ''}${item.contributor ? ` · contributore ${esc(item.contributor)}` : ''}${item.uploader ? ` · uploader ${esc(item.uploader)}` : ''}${item.date ? ` · ${esc(item.date)}` : ''}${item.language ? ` · lingua ${esc(item.language)}` : ''}</span>${item.subject ? `<br><span class="small">soggetti: ${esc(item.subject)}</span>` : ''}${item.description ? `<br><span class="small">${esc(item.description)}</span>` : ''}</p>` : ''}
    ${incoming?.query ? `<p class="small"><span class="label">query in entrata</span><br>${esc(incoming.query)}</p>` : ''}
    <p><span class="label">modello</span><br>vit–gpt2 · q8 · cpu locale · worker<br>${esc(state.modelStatus)}${state.inferenceMs ? ` · ${(state.inferenceMs / 1000).toFixed(2)} s` : ''}</p>
    <p><span class="label">descrizione</span><br>${esc(state.caption || '—')}${state.frameTime != null ? ` <span class="small">(${esc(state.frameSource || 'frame')} a ${state.frameTime.toFixed(1)} s)</span>` : ''}</p>
    <p><span class="label">keyword · priorità alla più specifica</span><br>${esc(state.terms.join(' · ') || '—')}${state.selectedTerm ? ` → <mark>${esc(state.selectedTerm)}</mark>` : ''}</p>
    <p><span class="label">query</span><br>${esc(next?.incoming?.query || state.query || '—')}<br><span class="small">${state.total != null ? `${state.total.toLocaleString('it')} risultati · fino a 10.000 campionabili · ` : ''}${state.checked} metadati verificati</span></p>
    <p><span class="label">successivo</span><br>${next ? marked(next.title, next.incoming?.terms || []) : esc(state.message)}</p>
    <p><span class="label">coda</span><br>${state.queueSemantic} della query pronti · ${state.queueGeneral} casuali pronti · ${state.loading} in preparazione<br><span class="small">streaming diretto · buffer corrente ${(state.buffer || 0).toFixed(1)} s · riproduzione ${(state.elapsed || 0).toFixed(0)} / ${MAX_PLAY_SECONDS} s${state.prepareMs ? ` · ultima preparazione ${(state.prepareMs / 1000).toFixed(1)} s` : ''}</span></p>
    <p class="small">${state.fallbacks} fallback casuali · ${state.switches} cambi · audio ${state.muted ? 'muto' : 'attivo'} · immagine ${state.fitMode === 'fill' ? 'fill' : 'fit'}<br>clic: ${state.queueGeneral + state.queueSemantic > 0 ? 'video pronto' : 'riserva in preparazione'}<br>primo clic: audio · poi clic / →: prossimo pronto<br>i informazioni · m audio · f schermo intero · esc esci · c fit/fill</p>
  `;
  if (openHistory) pane.querySelector('details')?.setAttribute('open', '');
  pane.scrollTop = scroll;
}
export function toggleInfo() { pane.hidden = !pane.hidden; }
