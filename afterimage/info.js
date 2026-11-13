import { highlightParts } from './terms.js';
import { historyState, exportChain, download } from './history.js';
import { filterState, updateFilters, filterDefaultsCode } from './scope.js';
import { copyChain, exportChainPDF, exportChainExcel, exportOptions } from './exports.js';
// Panel C: a short status and the actions on top, then every video of the
// session, newest first; scrolling down goes back in time.
const pane = document.querySelector('#info');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const marked = (value, terms) => highlightParts(value || '', terms).map(p => p.match ? `<u>${esc(p.text)}</u>` : esc(p.text)).join('');
const time = iso => iso ? new Date(iso).toTimeString().slice(0, 8) : '';
const STEP = 40;
let pdfShape = 'vertical', lastRender = 0, shownCount = STEP, listKey = '';

pane.addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.filter) updateFilters({ [el.dataset.filter]: el.checked });
  if (el.dataset.collection) { const set = new Set(filterState.collections); el.checked ? set.add(el.dataset.collection) : set.delete(el.dataset.collection); updateFilters({ collections: [...set] }); }
  if (el.id === 'pdfShape') exportOptions.shape = pdfShape = el.value;
});
pane.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]')?.dataset.action; if (!action) return;
  try {
    if (action === 'back' || action === 'next') window.dispatchEvent(new CustomEvent('afterimage:navigate', { detail: action === 'back' ? -1 : 1 }));
    if (action === 'fit') window.dispatchEvent(new Event('afterimage:fit'));
    if (action === 'report') window.dispatchEvent(new Event('afterimage:report'));
    if (action === 'copy') await copyChain();
    if (action === 'json') await exportChain();
    if (action === 'pdf') await exportChainPDF(pdfShape);
    if (action === 'excel') await exportChainExcel();
    if (action === 'older') { shownCount += STEP; listKey = ''; lastRender = 0; window.dispatchEvent(new Event('afterimage:info')); }
    if (action === 'defaults') download(new Blob([filterDefaultsCode()], { type: 'text/javascript' }), 'filter-defaults.js');
  } catch (error) { window.dispatchEvent(new CustomEvent('afterimage:export-error', { detail: error.message })); }
});

// One video of the session: the frame the model described (a link to the
// video, like the title), how it arrived, its description and the details.
function entry(record, previous, nowPlaying, preview) {
  const arrived = previous?.successor?.id === record.video.id ? previous.successor : null;
  const inTerms = arrived?.matchTerms || [];
  const outTerms = record.successor?.matchTerms || [record.queries?.at(-1)?.term].filter(Boolean);
  // Only what is not the normal flow is written: a random jump.
  const how = record.reason === 'fallback' ? '<br>NEW SESSION' : '';
  const link = esc(record.video.source);
  const image = preview ? `<a class="thumb" href="${link}" target="_blank" rel="noopener"><img src="${esc(preview)}" alt=""></a>` : '';
  return `<article${nowPlaying ? ' class="now"' : ''}>${image}
    <p class="title"><a href="${link}" target="_blank" rel="noopener">${marked(record.video.title, inTerms)}</a></p>
    <p>${time(record.at)}${nowPlaying ? '<br>now playing' : ''}${how}</p>
    <p>${record.description ? marked(record.description, outTerms) : 'description in progress…'}</p>
    <details data-section="record-${esc(record.at)}"><summary>details</summary><p>${[record.video.collection, record.video.creator, record.video.date, record.video.subject, record.queries?.at(-1)?.query, record.frame?.time != null ? `frame at ${record.frame.time.toFixed(1)} s` : '', record.frame?.source].filter(Boolean).map(esc).join('<br>')}</p></details>
  </article>`;
}

export function renderInfo(state, active) {
  if (pane.hidden || performance.now() - lastRender < 750) return;
  if (pane.contains(document.activeElement) && document.activeElement.matches('textarea,input,select')) return;
  lastRender = performance.now();
  const records = historyState.records;
  if (!pane.querySelector('.status')) pane.innerHTML = `<div class="status"></div>
    <p class="actions"><button data-action="back" aria-label="previous video">◀</button><button data-action="next" aria-label="next video">▶</button><button data-action="copy">copy chain</button><button data-action="json">json</button><button data-action="excel">excel</button><button data-action="pdf">pdf</button><select id="pdfShape" aria-label="pdf format"><option value="vertical">vertical</option><option value="square">square</option></select><button data-action="fit">fit / fill</button><button data-action="report">report</button></p>
    <textarea id="chainCopy" hidden readonly aria-label="chain to copy"></textarea>
    <div class="chain"></div><div class="more"></div><div class="filters"></div>`;
  pane.querySelector('#pdfShape').value = pdfShape;
  pane.querySelector('.status').innerHTML = `<p>${state.paused ? 'paused, preloading continues<br>' : ''}${state.queueSemantic} linked ready<br>${state.queueGeneral} random ready<br>${state.loading} preparing${state.message ? '<br>' + esc(state.message) : ''}</p>`;

  // The list changes only when a video or a description arrives; when it grows
  // at the top while you are scrolled down, the view stays on what you read.
  const last = records.at(-1), key = [records.length, last?.description, last?.frame?.preview ? 1 : 0, shownCount, active?.item?.id].join('|');
  if (key !== listKey) {
    listKey = key;
    const list = pane.querySelector('.chain'), before = list.scrollHeight, top = pane.scrollTop;
    const first = Math.max(0, records.length - shownCount);
    const html = [];
    for (let i = records.length - 1; i >= first; i--) {
      const record = records[i], nowPlaying = i === records.length - 1 && active?.item?.id === record.video.id;
      html.push(entry(record, records[i - 1], nowPlaying, record.frame?.preview || (nowPlaying ? state.preview : '')));
    }
    const open = [...list.querySelectorAll('details[open]')].map(el => el.dataset.section);
    list.innerHTML = html.join('') || '<p class="meta">no videos yet</p>';
    list.querySelectorAll('details').forEach(el => { if (open.includes(el.dataset.section)) el.open = true; });
    if (top > 0) pane.scrollTop = top + list.scrollHeight - before;
    pane.querySelector('.more').innerHTML = first > 0 ? `<p><button data-action="older">show ${Math.min(STEP, first)} older videos</button></p>` : '';
    renderFilters(active?.item, records);
  }
}

function renderFilters(item, records) {
  const box = pane.querySelector('.filters'), wasOpen = box.querySelector('details')?.open;
  const collections = [...new Set([...filterState.collections, ...(item?.collections || []), ...records.slice(-50).flatMap(r => r.video.collections || [])])];
  box.innerHTML = `<details data-section="filters"${wasOpen ? ' open' : ''}><summary>selection and filters</summary>
    <label><input type="checkbox" data-filter="content" ${filterState.content ? 'checked' : ''}> content exclusions</label>
    <label><input type="checkbox" data-filter="promotional" ${filterState.promotional ? 'checked' : ''}> trailers and promotional videos</label>
    ${collections.map(id => `<label><input type="checkbox" data-collection="${esc(id)}" ${filterState.collections.includes(id) ? 'checked' : ''}> exclude ${esc(id)}</label>`).join('')}
    <p><button data-action="defaults">download defaults for the site</button></p>
    <p class="meta">choices are kept in this browser; the downloaded file updates the published defaults</p></details>
    <p>${records.length} videos in the history<br>${historyState.saved ? 'history saved' : 'not saved: ' + esc(historyState.error)}</p>`;
}
export function toggleInfo() { pane.hidden = !pane.hidden; if (!pane.hidden) { listKey = ''; lastRender = 0; } }
