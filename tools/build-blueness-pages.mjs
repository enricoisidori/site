// Run after `node tools/build-blue.mjs movements`.
// 1. Copies the generated video page into the Cloudflare static assets, where it
//    shares an origin with the relay (iPhone Safari needs that to read pixels).
// 2. Replaces blueness/index.html on GitHub Pages with a borderless full-screen
//    frame of that page, so enricoisidori.com/blueness keeps its address. The
//    frame shows the intro SVG from its first paint, so the screen is never
//    black while the page loads.
import {mkdir,copyFile,rm,readFile,writeFile} from 'node:fs/promises';
const LIVE='https://blueness.blueness-pages.workers.dev/';
const root=new URL('../',import.meta.url),dist=new URL('cloudflare/blueness-pages/dist/',root);
// blue-video.html is an identical alias written by the same build.
const page=new URL('blue-video.html',root);
await rm(dist,{recursive:true,force:true});
for(const target of ['index.html','blueness/index.html']){const file=new URL(target,dist);await mkdir(new URL('./',file),{recursive:true});await copyFile(page,file);}
const icon=(await readFile(page,'utf8')).match(/<link rel="icon" href="[^"]+">/)?.[0]||'';
const svg=await readFile(new URL('blueness/intro-videos.svg',root),'utf8');
const layout=await readFile(new URL('./blueness-intro-layout.js',import.meta.url),'utf8');
await writeFile(new URL('blueness/index.html',root),`<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Blueness</title>${icon}
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;height:100dvh;border:0;display:block}#wait{position:fixed;inset:0;z-index:1;pointer-events:none}</style></head>
<body><iframe src="${LIVE}" title="Blueness" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
<div id="wait">${svg}</div>
<script>
// Page and video relay live on Cloudflare (same origin); this frame keeps the address.
const frame=document.querySelector('iframe');if(location.search)frame.src='${LIVE}'+location.search;
frame.addEventListener('load',()=>frame.focus());
${layout}
// Same SVG and geometry as the page (default 50 px square), visible at once.
const wait=document.getElementById('wait'),svg=wait.querySelector('svg');
const place=()=>layoutBluenessIntro(svg,innerWidth,innerHeight,50);place();addEventListener('resize',place);
// Last resort only: if the burst has not started after 1 s, a light sweeps
// across the SVG, like a loading shimmer (3 s per pass, intensity 80, band 40:
// chosen in demo-attesa.html). A normal load never shows it.
let shimmering=false;
const shimmer=setTimeout(()=>{shimmering=true;
 const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs');
 defs.innerHTML='<linearGradient id="blueness-wait" x1="0" x2="1" y1="0" y2="0" gradientTransform="translate(-1 0)"><stop offset="0" stop-color="#0700FF"/><stop offset=".1" stop-color="#0700FF"/><stop offset=".5" stop-color="#cdccff"/><stop offset=".9" stop-color="#0700FF"/><stop offset="1" stop-color="#0700FF"/><animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="1 0" dur="3s" repeatCount="indefinite"/></linearGradient>';
 svg.prepend(defs);for(const shape of svg.querySelectorAll('path,rect'))shape.setAttribute('fill','url(#blueness-wait)');
},1000);
// The page signals its first burst frame: it now shows the same SVG itself.
addEventListener('message',event=>{
 if(event.origin!==new URL('${LIVE}').origin||event.data!=='blueness:ready')return;
 clearTimeout(shimmer);if(!shimmering){wait.remove();return;}
 // The shimmer does not stop abruptly: from where it is, the band runs off to the right fast.
 const gradient=svg.querySelector('#blueness-wait'),loop=gradient.querySelector('animateTransform');
 // The loop is timed from the SVG document start (begin=0), so its phase is time mod 3 s.
 const at=-1+2*((svg.getCurrentTime()%3)/3);loop.remove();gradient.setAttribute('gradientTransform','translate('+at+' 0)');
 const exit=document.createElementNS('http://www.w3.org/2000/svg','animateTransform');
 for(const [k,v] of [['attributeName','gradientTransform'],['type','translate'],['from',at+' 0'],['to','1 0'],['dur','0.25s'],['fill','freeze'],['begin','indefinite']])exit.setAttribute(k,v);
 gradient.append(exit);exit.beginElement();setTimeout(()=>wait.remove(),260);
});
</script></body></html>
`);
process.stdout.write('Blueness assets: '+dist.pathname+'\nGitHub Pages frame: blueness/index.html\n');
