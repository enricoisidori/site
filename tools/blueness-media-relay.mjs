// Local Live Server/devtunnel adapter for the shared relay in blueness-media-core.mjs.
// Production uses the same handler in a Cloudflare Worker (blueness-media-worker.mjs).
import http from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';
import {createBluenessMediaHandler} from './blueness-media-core.mjs';
export {publicVideoURL} from './blueness-media-core.mjs';

export function createBluenessMediaRelay({fetchUpstream=fetch,idleMs=15000}={}){
 let active=0;
 const handle=createBluenessMediaHandler({fetchUpstream,status:()=>({active})});
 return http.createServer(async(req,res)=>{
  const controller=new AbortController();res.on('close',()=>controller.abort());
  // Forward only Range: never the client's cookies or credentials.
  const range=req.headers.range,video=new URL(req.url,'http://localhost').pathname.endsWith('/video');
  // No stream cap: Safari keeps one open per media element. A stream the
  // client stopped reading (paused video) is closed after idleMs instead;
  // Safari reopens it with a new Range request when it needs more bytes.
  if(video)active++;
  let idle;const touch=()=>{clearTimeout(idle);idle=setTimeout(()=>res.destroy(),idleMs);};
  try{
   const response=await handle(new Request(new URL(req.url,'http://localhost'),{method:req.method,headers:range?{Range:range}:{},signal:controller.signal}));
   res.writeHead(response.status,Object.fromEntries(response.headers));
   if(!response.body)res.end();
   else{touch();const body=Readable.fromWeb(response.body);body.on('data',touch);await pipeline(body,res);}
  }catch{
   if(!res.destroyed){if(res.headersSent)res.destroy();else{res.writeHead(502);res.end();}}
  }finally{clearTimeout(idle);if(video)active--;controller.abort();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.BLUENESS_RELAY_PORT||5505);
 createBluenessMediaRelay().listen(port,'127.0.0.1',()=>process.stdout.write('Blueness media relay: http://127.0.0.1:'+port+'\n'));
}
