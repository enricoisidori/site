const storageKey = document.title + ':chain:v1';
let records = [], current;
export const historyState = { records, saved: true, error: '' };
try {
  const loaded = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(loaded)) records.push(...loaded.slice(-2000));
} catch (error) { historyState.saved = false; historyState.error = error.message; }
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(records)); historyState.saved = true; historyState.error = ''; }
  catch (error) { historyState.saved = false; historyState.error = error.message; }
}
const videoInfo = item => ({ id: item.id, title: item.title, source: item.source, collection: item.collection });
export function beginChain(item, reason) {
  current = { at: new Date().toISOString(), video: videoInfo(item), reason, description: '', keywords: [], queries: [], successor: null };
  records.push(current);
  if (records.length > 2000) records.splice(0, records.length - 2000);
  persist();
}
export function describeChain(caption, keywords, frame) {
  if (!current) return;
  Object.assign(current, { description: caption, keywords: [...keywords], frame }); persist();
}
export function queryChain(term, query, total = null) {
  if (!current) return;
  const previous = current.queries[current.queries.length - 1];
  if (previous?.term === term) Object.assign(previous, { query, total });
  else current.queries.push({ at: new Date().toISOString(), term, query, total });
  persist();
}
export function finishChain(item, reason) {
  if (!current) return;
  current.successor = { ...videoInfo(item), reason, matchTerms: item.incoming?.terms || [], query: item.incoming?.query || '' };
  current.finishedAt = new Date().toISOString(); persist();
}
export function exportChain() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ project: document.title, exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = document.title + '-catena-' + Date.now() + '.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
