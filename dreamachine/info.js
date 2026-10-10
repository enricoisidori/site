export function setupInfo(state, videos) {
  const panel = document.querySelector('#info');
  const fields = document.querySelector('#info-fields');
  const predictions = document.querySelector('#info-predictions');
  const frame = document.querySelector('#info-frame');
  const image = document.querySelector('#info-image');
  const caption = document.querySelector('#info-caption');
  const error = document.querySelector('#info-error');
  const rows = new Map();
  const chain = document.querySelector('#info-chain');
  const reason = document.querySelector('#info-reason');
  const match = document.querySelector('#info-match');
  const selectionAttempts = document.querySelector('#info-selection-attempts');
  const searchAttempts = document.querySelector('#info-search-attempts');
  function attempts(element, list = []) {
    const signature = JSON.stringify(list);
    if (element.dataset.signature === signature) return;
    element.dataset.signature = signature;
    element.replaceChildren();
    for (const attempt of list) {
      const li = document.createElement('li');
      const field = { title: 'Titolo', description: 'Descrizione', subject: 'Soggetti' }[attempt.field];
      li.textContent = `${attempt.query === '(random)' ? 'Casuale' : `“${attempt.query}”${field ? ` nel campo ${field}` : ''}`} → ${attempt.status}${attempt.count === null ? '' : ` · ${attempt.count} risultati nella pagina`}`;
      element.append(li);
    }
  }
  const phases = { starting: 'Avvio', playing: 'Riproduzione', analyzing: 'Analisi fotogramma', preparing: 'Ricerca / precaricamento', retrying: 'Nuovo tentativo · il video continua' };
  const vision = { loading: 'Caricamento', ready: 'Pronto · inferenza locale', unavailable: 'Non disponibile · riproverà' };
  const time = value => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '—';
  function render() {
    if (panel.hidden) return;
    const active = videos.find(video => video.classList.contains('active'));
    const selected = state.selection;
    const imageMode = state.kind === 'image';
    const objects = selected?.objects.slice(0, 3).map(p => `${p.label.split(',')[0]} (${(p.score * 100).toFixed(1)}%)`).join(', ');
    chain.textContent = selected
      ? `${objects || 'Nessun oggetto usato'}\n↓\n${selected.query ? `Query: “${selected.query}”` : 'Estrazione casuale'}\n↓\n${selected.to}`
      : 'In attesa del primo contenuto…';
    const reasons = {
      visual: `✓ COLLEGAMENTO RIUSCITO · “${selected?.query}” verificato nel campo ${{ title: 'Titolo', description: 'Descrizione', subject: 'Soggetti' }[selected?.field]}. Origine: ${selected?.from}. La corrispondenza testuale non garantisce l’accuratezza del riconoscimento.`,
      initial: `${imageMode ? 'Prima immagine' : 'Primo video'}: estrazione casuale iniziale, prima di qualsiasi riconoscimento.`,
      fallback: 'Le query visive non hanno prodotto un candidato riproducibile tra quelli provati. Ripiego su un video casuale.',
      'no-recognition': 'Nessuna etichetta utilizzabile o modello non disponibile: estrazione casuale.',
    };
    reason.textContent = selected ? reasons[selected.mode] : '';
    const matchSignature = JSON.stringify(selected?.matches || []);
    if (match.dataset.signature !== matchSignature) {
      match.dataset.signature = matchSignature;
      match.replaceChildren();
      for (const evidence of selected?.matches || []) {
        const row = document.createElement('span');
        const highlighted = document.createElement('mark');
        highlighted.textContent = evidence.keyword;
        row.append(`${evidence.field}: “…${evidence.before}`, highlighted, `${evidence.after}…”`);
        match.append(row, document.createElement('br'));
      }
    }
    attempts(selectionAttempts, selected?.attempts);
    attempts(searchAttempts, state.search?.attempts);
    const values = [
      ['Modello', 'MobileViT Small · q8\nTransformers.js · WASM / CPU'],
      ['Visione', vision[state.vision] || state.vision],
      ['Processo', phases[state.phase] || state.phase],
      ['Titolo', state.current?.title || 'Ricerca iniziale…'],
      ['File', state.current?.filename || '—'],
      [imageMode ? 'Dimensioni' : 'Tempo', imageMode ? state.current?.dimensions : active ? `${time(active.currentTime)} / ${time(active.duration)} · loop` : '—'],
      ['Query attuale', selected?.query || (selected ? 'Casuale · vedi motivo sopra' : '—')],
      ['Query prossima', state.query === '(random)' ? 'Casuale' : state.query || '—'],
      ['Esito prossimo', state.search?.status || 'In ricerca · il contenuto corrente resta visibile'],
      [imageMode ? 'Immagini viste' : 'Video visti', String(state.history.length)],
      ['Fonte', state.current?.source],
      ['Licenza', state.current?.license || 'Non dichiarata nei metadati'],
    ];
    for (const [label, value] of values) {
      let dd = rows.get(label);
      if (!dd) {
        const dt = document.createElement('dt');
        dd = document.createElement('dd');
        dt.textContent = label;
        fields.append(dt, dd);
        rows.set(label, dd);
      }
      if (dd.dataset.value === String(value || '—')) continue;
      dd.dataset.value = String(value || '—');
      dd.replaceChildren();
      if (label === 'Fonte' && value) {
        const link = document.createElement('a');
        link.href = value;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `${state.provider || 'Internet Archive'} ↗`;
        dd.append(link);
      } else dd.textContent = value || '—';
    }
    frame.hidden = !state.analysis;
    if (state.analysis) {
      if (image.getAttribute('src') !== state.analysis.image) image.src = state.analysis.image;
      caption.textContent = imageMode ? `Immagine analizzata · ${state.analysis.title}` : `Fotogramma analizzato · ${state.analysis.title} · ${time(state.analysis.time)}`;
    }
    predictions.replaceChildren();
    for (const prediction of state.predictions) {
      const row = document.createElement('li');
      const label = document.createElement('span');
      const confidence = document.createElement('span');
      label.textContent = prediction.label;
      confidence.textContent = `${(prediction.score * 100).toFixed(1)}%`;
      row.append(label, confidence);
      predictions.append(row);
    }
    if (!state.predictions.length) {
      const row = document.createElement('li');
      row.textContent = 'In attesa di un riconoscimento…';
      predictions.append(row);
    }
    error.hidden = !state.lastError;
    error.textContent = state.lastError ? `Ultimo errore: ${state.lastError}` : '';
  }
  document.addEventListener('keydown', event => {
    if (event.code !== 'KeyI' || event.repeat || event.ctrlKey || event.metaKey || event.altKey
      || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) document.dispatchEvent(new Event('spiral:info-open'));
    render();
  });
  // Refresh only the visible overlay; playback and recognition remain independent.
  setInterval(render, 500);
}
