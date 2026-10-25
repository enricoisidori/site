import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=await readFile(process.env.RECORDING_FIXTURE||new URL('../../afterimage/tests/fixture.mp4',import.meta.url));
const seeds=JSON.parse(await readFile(new URL('../catalogs/blueness.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();let metadata=0;const shownBeforeSearch=[];
 await page.addInitScript(seeds=>{
  localStorage.setItem('blue-played-v1',JSON.stringify(seeds.map(item=>{const u=new URL(item.source);return decodeURIComponent(u.hostname+u.pathname).replace(/_/g,' ').normalize('NFC');})));
  localStorage.setItem('blue-candidates-v1',JSON.stringify([{candidatePolicy:'general-or-color-tag-v1',provider:'archive',kind:'video',id:'verified',url:'https://archive.org/cors/verified/clip.mp4',source:'https://archive.org/details/verified',title:'verified blue',filename:'clip.mp4',startTime:0,verified:true}]));
 },seeds);
 await page.route('https://archive.org/cors/verified/clip.mp4',r=>r.fulfill({contentType:'video/mp4',headers:{'Access-Control-Allow-Origin':'*'},body:fixture}));
 await page.route('https://archive.org/metadata/**',r=>{metadata++;return r.abort();});
 await page.route(/https:\/\/(commons\.wikimedia\.org\/w\/api|archive\.org\/(advancedsearch|services\/search))/,async r=>{shownBeforeSearch.push(await page.evaluate(()=>window.blueStatus?.shown||0));return r.abort();});
 await page.goto(new URL('../../bluenessmovements/index.html',import.meta.url).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.blueStatus?.shown===1);
 assert.equal(metadata,0,'verified direct URL must not request metadata again');
 assert.ok(shownBeforeSearch.every(n=>n>=1),'initial catalog must show a video before network discovery');
 assert.equal(await page.evaluate(()=>window.blueStatus.checked),1,'verified start frame needs one blue check');
 console.log('PASS: warm start without metadata or prior search, pixel check retained');
}finally{await browser.close();}
