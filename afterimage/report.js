// Session report: everything worth knowing about this run, written as a plain
// .txt when the key 1 is pressed. Kept in memory for the current page only.
const started = new Date(), t0 = performance.now();
const videos = [], stalls = [], events = [];
const count = { short: 0, replays: 0, extended: 0, pauses: 0, hiddenMs: 0, visionOK: 0, visionFail: 0, inferenceMs: 0, prepareMs: [], emptyKeywords: 0, keywordChanges: 0, backupUsed: 0 };
let firstVideoMs = null, firstPictureMs = null, hiddenAt = null, current = null;
const terms = new Map();

const clock = ms => new Date(started.getTime() + ms).toTimeString().slice(0, 8);
const dur = ms => {
  if (ms == null || !isFinite(ms)) return '–';
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return h ? `${h} h ${m} min` : m ? `${m} min ${s % 60} s` : (ms < 10000 ? (ms / 1000).toFixed(1) : s) + ' s';
};
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 + '%' : '–';
const now = () => performance.now() - t0;

export const report = {
  firstPicture() { firstPictureMs ??= now(); },
  // reason: startup | query | fallback | click; cause: why a random video came.
  video(item, reason, { cause = '', keyword = '' } = {}) {
    const at = now();
    if (current) current.onScreen = at - current.at;
    if (firstVideoMs == null) firstVideoMs = at;
    current = { at, id: item.id, title: item.title || '', duration: item.duration || 0, reason, cause, keyword, caption: '', stalls: 0, replays: 0 };
    videos.push(current);
    if (keyword) terms.set(keyword, (terms.get(keyword) || 0) + 1);
  },
  caption(text, inferenceMs) { if (current) current.caption = text; count.visionOK++; count.inferenceMs += inferenceMs || 0; },
  visionFailed(message) { count.visionFail++; events.push([now(), 'descrizione non riuscita: ' + message]); },
  stall(ms) { stalls.push([now() - ms, ms, current?.title || '']); if (current) current.stalls++; },
  replay() { count.replays++; if (current) current.replays++; },
  short() { count.short++; },
  extended() { count.extended++; },
  emptyKeyword(term) { count.emptyKeywords++; events.push([now(), `nessun risultato per "${term}"`]); },
  keywordChange() { count.keywordChanges++; },
  backup() { count.backupUsed++; },
  prepared(ms) { if (ms) count.prepareMs.push(ms); },
  pause() { count.pauses++; },
  // Problems only (video titles in "preparing …" messages may contain these words).
  message(text) { if (!/^(preparing|describing|looking|finding|linked) /i.test(text || '') && /archive|timeout|http|error|not answering|too short|unavailable/i.test(text || '')) events.push([now(), text]); },
  visibility(hidden) {
    if (hidden) hiddenAt = now(); else if (hiddenAt != null) { count.hiddenMs += now() - hiddenAt; hiddenAt = null; }
  },
  text(extra = {}) {
    const total = now(), shown = videos.length;
    if (current) current.onScreen = total - current.at;
    const by = r => videos.filter(v => v.reason === r).length;
    const linked = by('query'), random = by('fallback'), clicks = by('click');
    const switches = shown - 1;
    // Only finished videos: the one still on screen would look short.
    const onScreen = videos.slice(0, -1).map(v => v.onScreen || 0).filter(Boolean);
    const avg = onScreen.length ? onScreen.reduce((a, b) => a + b, 0) / onScreen.length : null;
    const stallTotal = stalls.reduce((a, s) => a + s[1], 0);
    const causes = {};
    for (const v of videos) if (v.reason === 'fallback') causes[v.cause || 'non indicata'] = (causes[v.cause || 'non indicata'] || 0) + 1;
    const prep = [...count.prepareMs].sort((a, b) => a - b);
    const L = [];
    // Summary first: the numbers that matter, with █ on every one that is not zero.
    const errors = events.filter(e => !/nessun risultato/.test(e[1])).length;
    const BAR = '█'.repeat(48);
    const mark = (label, value, bad) => `${bad ? '█' : ' '} ${label.padEnd(34)} ${value}`;
    L.push('AFTERIMAGE — REPORT DELLA SESSIONE', '', BAR);
    L.push(mark('Durata', dur(total), false));
    L.push(mark('Video mostrati', String(shown), false));
    L.push(mark('NEW SESSION (salti casuali)', `${random} su ${Math.max(0, switches)} cambi`, random > 0));
    L.push(mark('Loop (spezzone ripetuto)', String(count.replays), count.replays > 0));
    L.push(mark('Interruzioni (video fermo)', stalls.length ? `${stalls.length}, in tutto ${dur(stallTotal)}` : '0', stalls.length > 0));
    L.push(mark('Errori e segnalazioni', String(errors), errors > 0));
    L.push(mark('Richieste Archive non riuscite', extra.archive ? String(extra.archive.failures) : '–', !!extra.archive?.failures));
    L.push(mark('Descrizioni non riuscite', String(count.visionFail), count.visionFail > 0));
    L.push(mark('Primo video dopo', firstVideoMs == null ? 'nessuno' : dur(firstVideoMs), firstVideoMs == null || firstVideoMs > 10000));
    L.push(BAR, '(█ = da guardare)', '');
    L.push(`Inizio:      ${started.toLocaleString('it-IT')}`);
    L.push(`Report:      ${new Date().toLocaleString('it-IT')}`);
    L.push(`Durata:      ${dur(total)}${count.hiddenMs ? ` (di cui ${dur(count.hiddenMs)} con la pagina nascosta)` : ''}`);
    L.push(`Dispositivo: ${navigator.userAgent}`);
    L.push(`Schermo:     ${innerWidth}×${innerHeight} px, densità ${devicePixelRatio}`);
    L.push(`Indirizzo:   ${location.href}`, '');
    L.push('AVVIO');
    L.push(`Prima immagine della raffica: ${firstPictureMs == null ? 'nessuna' : dur(firstPictureMs)}`);
    L.push(`Primo video:                  ${firstVideoMs == null ? 'nessuno' : dur(firstVideoMs)}`, '');
    L.push('CONTINUITÀ');
    L.push(`Video mostrati:            ${shown}`);
    L.push(`Cambi:                     ${Math.max(0, switches)}`);
    L.push(`  collegati (parola):      ${linked} (${pct(linked, Math.max(0, switches))})`);
    L.push(`  NEW SESSION (casuali):   ${random} (${pct(random, Math.max(0, switches))})`);
    for (const [cause, n] of Object.entries(causes)) L.push(`      ${n} × ${cause}`);
    L.push(`  con un clic:             ${clicks}`);
    L.push(`Tempo medio per video:     ${dur(avg)} (min ${dur(onScreen.length ? Math.min(...onScreen) : null)}, max ${dur(onScreen.length ? Math.max(...onScreen) : null)})`);
    L.push(`Video tenuti oltre 30 s in attesa del successivo: ${count.extended}`);
    L.push(`Spezzoni ripetuti (video finito prima del successivo): ${count.replays}`);
    L.push(`Video scartati perché troppo corti: ${count.short}`);
    L.push(`Seconda parola usata come riserva: ${count.backupUsed}`);
    L.push(`Parole senza risultati: ${count.emptyKeywords}`, '');
    L.push('INTERRUZIONI (video fermo a caricare)');
    L.push(`Numero:        ${stalls.length}`);
    L.push(`Tempo totale:  ${dur(stallTotal)} (${pct(stallTotal, total)} della sessione)`);
    L.push(`Più lunga:     ${dur(stalls.length ? Math.max(...stalls.map(s => s[1])) : null)}`);
    for (const [at, ms, title] of stalls.slice(-40)) L.push(`█ ${clock(at)}  ${dur(ms).padEnd(8)}  ${title.slice(0, 70)}`);
    L.push(`Pause manuali: ${count.pauses}`, '');
    L.push('ARCHIVE');
    if (extra.archive) {
      L.push(`Richieste di dati (ricerche + metadati): ${extra.archive.requests}`);
      L.push(`Non riuscite:                            ${extra.archive.failures} (${pct(extra.archive.failures, extra.archive.requests)})`);
      L.push(`Media al minuto:                         ${(extra.archive.requests / Math.max(1, total / 60000)).toFixed(1)}`);
    }
    L.push(`Preparazione di un video: mediana ${dur(prep[prep.length >> 1])}, la più lenta ${dur(prep.at(-1))}`, '');
    L.push('DESCRIZIONI (modello locale)');
    L.push(`Riuscite: ${count.visionOK}, non riuscite: ${count.visionFail}, tempo medio ${count.visionOK ? Math.round(count.inferenceMs / count.visionOK) + ' ms' : '–'}`);
    const top = [...terms].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t, n]) => n > 1 ? `${t} (${n})` : t);
    L.push(`Parole che hanno collegato i video: ${top.join(', ') || '–'}`, '');
    if (events.length) {
      L.push('SEGNALAZIONI');
      for (const [at, text] of events.slice(-40)) L.push(`  ${clock(at)}  ${text}`);
      L.push('');
    }
    L.push('ELENCO DEI VIDEO (ora · tempo sullo schermo · come è arrivato · titolo)');
    const how = v => v.reason === 'query' ? `parola "${v.keyword}"` : v.reason === 'fallback' ? `NEW SESSION${v.cause ? ' – ' + v.cause : ''}` : v.reason === 'click' ? 'clic' : 'avvio';
    for (const v of videos) {
      const problems = [v.reason === 'fallback' && 'NEW SESSION', v.replays && `loop ×${v.replays}`, v.stalls && `${v.stalls} interruzioni`].filter(Boolean);
      L.push(`${problems.length ? '█' : ' '} ${clock(v.at)}  ${(dur(v.onScreen) + (v === current ? '+' : '')).padEnd(8)}  ${how(v)}${v === current ? '  (in corso)' : ''}${problems.length ? '  █ ' + problems.join(', ') : ''}`);
      L.push(`          ${v.title.slice(0, 100)}`);
      L.push(`          https://archive.org/details/${v.id}`);
      if (v.caption) L.push(`          descrizione: ${v.caption}`);
    }
    return L.join('\n') + '\n';
  },
};
