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
      window[name] = () => {}; const expiry=setTimeout(() => { delete window[name]; }, 60000);expiry.unref?.();
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
// Healthy requests still use one connection. Alternatives start only when
// the preferred path stalls; the first valid result cancels the other paths.
function later(ms, signal) {
  return new Promise((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});
  });
}
// One shared budget for every JSON request to Archive (searches and metadata):
// short bursts pass at once, sustained traffic stays under ~90 requests a
// minute. While Archive is failing the budget shrinks, and no parallel
// recovery paths are opened, so a struggling (or limiting) Archive is not
// asked even more.
const RATE = 1.5, BURST = 8;
let tokens = BURST, refilledAt = Date.now(), trouble = 0;
// Returns null when a request may go now, otherwise how many ms to wait.
function budget() {
  const now = Date.now(), rate = RATE / (1 + trouble);
  tokens = Math.min(BURST, tokens + (now - refilledAt) / 1000 * rate); refilledAt = now;
  if (tokens >= 1) { tokens--; return null; }
  return Math.ceil((1 - tokens) / rate * 1000);
}
export const archiveHealth = () => ({ tokens, trouble });
const stats = { requests: 0, failures: 0 };
export const archiveStats = () => ({ ...stats });
// Tests start each case with a full budget.
export function resetArchiveBudget() { tokens = BURST; trouble = 0; refilledAt = Date.now(); }
export async function archiveJSON(url, signal, options) {
  for (let wait = budget(); wait != null; wait = budget()) await later(wait, signal || new AbortController().signal);
  signal?.throwIfAborted();
  stats.requests++;
  try { const data = await request(url, signal, options); trouble = Math.max(0, trouble - 1); return data; }
  catch (error) { if (!signal?.aborted) { trouble = Math.min(8, trouble + 1); stats.failures++; } throw error; }
}
async function request(url, signal, { scrape: allowScrape = true } = {}) {
  if(!url.includes('/advancedsearch.php'))return direct(url,signal);
  const controller=new AbortController(),combined=AbortSignal.any([controller.signal,AbortSignal.timeout(14000),...(signal?[signal]:[])]);
  const original=new URL(url),params=new URLSearchParams({q:original.searchParams.get('q'),fields:'identifier,title',count:'100'});
  const sort=original.searchParams.get('sort[]');if(sort)params.set('sorts',sort);
  if(original.searchParams.get('rows')==='1')params.set('total_only','true');
  const scrape=async()=>{
    const data=await direct('https://archive.org/services/search/v1/scrape?'+params,combined);
    if(data.total==null)throw new Error('risposta Archive incompleta');
    return {response:{numFound:Number(data.total),docs:data.items||[]},recovery:true};
  };
  const validate=data=>{if(data.response?.numFound==null)throw new Error('risposta Archive incompleta');return data;};
  const preferred=(location.protocol==='file:'?jsonp(url,combined):direct(url,combined)).then(validate);
  const alternatives=[];
  const fallback=async(ms,paths,task)=>{const result=await Promise.race([later(ms,combined).then(()=>null),Promise.any(paths).catch(()=>null)]);combined.throwIfAborted();return result??task();};
  if(location.protocol!=='file:'&&!trouble)alternatives.push(fallback(4000,[preferred],async()=>validate(await jsonp(url,combined))));
  // Scrape ignores page and would break the uniform draw: opt-out per call.
  if(allowScrape&&!trouble)alternatives.push(fallback(location.protocol==='file:'?1500:3000,[preferred,...alternatives],scrape));
  try{return await Promise.any([preferred,...alternatives]);}
  catch(error){if(signal?.aborted)throw signal.reason;throw new Error('Internet Archive non risponde alla ricerca; riprovo automaticamente');}
  finally{controller.abort();}
}
