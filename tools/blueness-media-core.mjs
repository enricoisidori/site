// Same-origin Range relay for Blueness video on iOS, written against Web
// Request/Response so the local relay (Node) and the Cloudflare Worker share it.
// Public video hosts only. No cookies, credentials or complete-file buffering.
export const SERVICE='blueness-range-relay';
const USER_AGENT='BluenessMediaRelay/1.0 (https://enricoisidori.com/blueness/)';
export function publicVideoURL(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw Error('origine video non consentita');
 if(url.hostname==='archive.org'&&url.pathname.startsWith('/cors/'))url.pathname=url.pathname.replace('/cors/','/download/');
 const commons=url.hostname==='upload.wikimedia.org'&&url.pathname.startsWith('/wikipedia/commons/');
 const archive=url.hostname==='archive.org'&&url.pathname.startsWith('/download/');
 const mirror=url.hostname.endsWith('.archive.org')&&/^\/\d+\/items\//.test(url.pathname);
 if(!(commons||archive||mirror)||! /\.(mp4|webm|ogv|m4v|mov)$/i.test(decodeURIComponent(url.pathname)))throw Error('origine video non consentita');
 url.hash='';return url.href;
}
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export function createBluenessMediaHandler({fetchUpstream=(url,init)=>fetch(url,init),timeoutMs=10000,status=()=>({})}={}){
 const redirects=new Map();let requests=0;
 return async function handle(request){
  const url=new URL(request.url),path=url.pathname.replace(/^\/__blueness_media(?=\/)/,'');
  if(path==='/status'&&request.method==='GET')return json(200,{service:SERVICE,version:1,requests,...status()});
  if(path!=='/video')return json(404,{error:'percorso non disponibile'});
  if(!['GET','HEAD'].includes(request.method))return json(405,{error:'metodo non consentito'});
  let original;
  try{original=publicVideoURL(url.searchParams.get('url'));}catch{return json(400,{error:'origine video non consentita'});}
  const range=request.headers.get('range');
  if(range&&!/^bytes=(?:\d+-\d*|-\d+)$/.test(range))return json(400,{error:'Range singolo richiesto'});
  requests++;
  // The timeout covers the upstream headers only; the body then streams for as
  // long as the client keeps reading. A client disconnect aborts upstream too.
  const headersTimeout=new AbortController(),timer=setTimeout(()=>headersTimeout.abort(Error('timeout origine video')),timeoutMs);
  const signal=request.signal?AbortSignal.any([request.signal,headersTimeout.signal]):headersTimeout.signal;
  try{
   const cached=redirects.get(original);let target=cached&&cached.expires>Date.now()?cached.url:original,response;
   // Wikimedia rejects requests without an identifying User-Agent (workerd sends none).
   const headers={'Accept-Encoding':'identity','User-Agent':USER_AGENT,...(range?{Range:range}:{})};
   for(let hop=0;hop<6;hop++){
    target=publicVideoURL(target);
    response=await fetchUpstream(target,{method:request.method,headers,redirect:'manual',signal});
    if(![301,302,303,307,308].includes(response.status))break;
    const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('redirect video incompleto');
    target=publicVideoURL(new URL(location,target).href);response=null;
   }
   clearTimeout(timer);
   if(!response)throw Error('troppi redirect video');
   // Pass rate limiting through (with Retry-After) instead of masking it as 502.
   if(response.status===429){await response.body?.cancel();const retry=response.headers.get('retry-after');return new Response(JSON.stringify({error:'origine HTTP 429'}),{status:429,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(retry?{'Retry-After':retry}:{})}});}
   if(![200,206,416].includes(response.status)){await response.body?.cancel();throw Error('origine HTTP '+response.status);}
   if(range&&request.method==='GET'&&response.status===200){await response.body?.cancel();throw Error('origine non supporta richieste parziali');}
   if(response.status===206&&!/^bytes \d+-\d+\/\d+$/.test(response.headers.get('content-range')||'')){await response.body?.cancel();throw Error('Content-Range non valido');}
   if(response.status!==416){redirects.set(original,{url:target,expires:Date.now()+300000});if(redirects.size>100)redirects.delete(redirects.keys().next().value);}
   const output=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
   for(const name of ['content-type','content-length','content-range','last-modified']){const value=response.headers.get(name);if(value)output.set(name,value);}
   const etag=response.headers.get('etag');if(etag&&!etag.startsWith('W/'))output.set('ETag',etag);
   if(request.method==='HEAD'){await response.body?.cancel();return new Response(null,{status:response.status,headers:output});}
   return new Response(response.body,{status:response.status,headers:output});
  }catch(error){
   return json(502,{error:error.message||'origine non disponibile'});
  }finally{clearTimeout(timer);}
 };
}
