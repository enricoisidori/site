// Normal requests keep the original fetch path. Search can recover through
// Archive JSONP, then the independent scrape endpoint, without a private proxy.
let sequence = 0;
function jsonp(url, signal) {
  const target = new URL(url);
  if (target.origin !== 'https://archive.org' || target.pathname !== '/advancedsearch.php') throw new Error('invalid JSONP endpoint');
  return new Promise((resolve, reject) => {
    const name = '__archive' + Date.now() + '_' + (++sequence);
    const script = document.createElement('script');
    let timer, settled = false;
    const finish = (error, data) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort); script.remove();
      window[name] = () => {}; setTimeout(() => { delete window[name]; }, 60000);
      error ? reject(error) : resolve(data);
    };
    const abort = () => finish(signal.reason || new DOMException('aborted', 'AbortError'));
    if (signal?.aborted) return abort();
    window[name] = data => data.error ? finish(new Error(String(data.error))) : finish(null, data);
    script.onerror = () => finish(new Error('ricerca Archive non disponibile'));
    target.searchParams.set('callback', name); script.src = target.href;
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(new Error('timeout ricerca Archive')), 8000);
    document.head.append(script);
  });
}
async function direct(url, signal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(10000)]) });
  if (!response.ok) throw new Error('Archive HTTP ' + response.status);
  const data = await response.json();
  if (data.error) throw new Error(String(data.error));
  return data;
}
export async function archiveJSON(url, signal) {
  const search = url.includes('/advancedsearch.php');
  let error;
  // file:// sends Origin:null; avoid the known failing fetch before JSONP.
  if (!search || location.protocol !== 'file:') {
    try { return await direct(url, signal); }
    catch (failure) { if (signal?.aborted) throw failure; error = failure; }
  }
  if (!search) throw error;
  try { return await jsonp(url, signal); }
  catch (failure) { if (signal?.aborted) throw failure; error = failure; }
  const original = new URL(url);
  const params = new URLSearchParams({ q: original.searchParams.get('q'), fields: 'identifier,title', count: '100' });
  const sort = original.searchParams.get('sort[]'); if (sort) params.set('sorts', sort);
  if (original.searchParams.get('rows') === '1') params.set('total_only', 'true');
  try {
    const data = await direct('https://archive.org/services/search/v1/scrape?' + params, signal);
    if (data.total == null) throw new Error('risposta Archive incompleta');
    // Recovery still applies the full query; randomness is limited to this batch.
    return { response: { numFound: Number(data.total), docs: data.items || [] }, recovery: true };
  } catch (failure) {
    if (signal?.aborted) throw failure;
    throw new Error('ricerca Archive non disponibile: ' + (failure.message || error.message));
  }
}
