// Copies the Afterimage app (no tests or notes) into the Cloudflare static assets.
import {cp,rm,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),source=new URL('afterimage/',root),dist=new URL('cloudflare/afterimage/dist/',root);
await rm(dist,{recursive:true,force:true});
await cp(source,dist,{recursive:true,filter:path=>!/\/(tests|node_modules)(\/|$)|\.md$|package\.json$|\.DS_Store$/.test(path)});
// Hugging Face answers 404 to model requests with a *.workers.dev Referer:
// send none, for the page and its module worker alike.
await writeFile(new URL('_headers',dist),'/*\n  Referrer-Policy: no-referrer\n');
process.stdout.write('Afterimage assets: '+dist.pathname+'\n');
