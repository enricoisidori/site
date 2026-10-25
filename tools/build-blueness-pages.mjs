// Run after `node tools/build-blue.mjs movements`.
// 1. Copies the generated video page into the Cloudflare static assets, where it
//    shares an origin with the relay (iPhone Safari needs that to read pixels).
// 2. Replaces blueness/index.html on GitHub Pages with a borderless full-screen
//    frame of that page, so enricoisidori.com/blueness keeps its address.
import {mkdir,copyFile,rm,readFile,writeFile} from 'node:fs/promises';
const LIVE='https://blueness.blueness-pages.workers.dev/';
const root=new URL('../',import.meta.url),dist=new URL('cloudflare/blueness-pages/dist/',root);
// blue-video.html is an identical alias written by the same build.
const page=new URL('blue-video.html',root);
await rm(dist,{recursive:true,force:true});
for(const target of ['index.html','blueness/index.html']){const file=new URL(target,dist);await mkdir(new URL('./',file),{recursive:true});await copyFile(page,file);}
const icon=(await readFile(page,'utf8')).match(/<link rel="icon" href="[^"]+">/)?.[0]||'';
await writeFile(new URL('blueness/index.html',root),`<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Blueness</title>${icon}
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;height:100dvh;border:0;display:block}</style></head>
<body><iframe src="${LIVE}" title="Blueness" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
<script>
// Page and video relay live on Cloudflare (same origin); this frame keeps the address.
const frame=document.querySelector('iframe');if(location.search)frame.src='${LIVE}'+location.search;
frame.addEventListener('load',()=>frame.focus());
</script></body></html>
`);
process.stdout.write('Blueness assets: '+dist.pathname+'\nGitHub Pages frame: blueness/index.html\n');
