// Short controlled integration check: real browser, worker, decoder and storage.
// Remote Archive/model responses are fixtures, avoiding large model downloads.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..'), fixture = await readFile(resolve(root, 'afterimage/tests/fixture.mp4'));
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    assert.ok(path.startsWith(root + '/'));
    res.setHeader('Content-Type', extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : extname(path) === '.svg' ? 'image/svg+xml' : 'text/html');
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const project of ['afterimage', 'dreamachine']) for (const local of [false, true]) {
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
    page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE', message.text()); });
    let serial = 0, holdCaption = false;
    await context.route('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js', route => route.fulfill({
      contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' },
      body: holdCaption
        ? `export const env={backends:{onnx:{wasm:{}}}}; export class RawImage{}; export async function pipeline(){return async()=>new Promise(()=>{});}`
        : `export const env={backends:{onnx:{wasm:{}}}}; export class RawImage{}; export async function pipeline(){return async()=>{await new Promise(r=>setTimeout(r,600));return [{generated_text:'a rowing boat on water'}];}}`,
    }));
    await context.route('https://archive.org/advancedsearch.php?**', route => {
      const url = new URL(route.request().url()), callback = url.searchParams.get('callback');
      if (!local && project === 'afterimage' && !callback) return route.abort('failed');
      if (project === 'dreamachine' && url.searchParams.get('q').includes('mediatype:movies')) assert.ok(Number(url.searchParams.get('page')) <= 1, 'count restricted collections before paging');
      const docs = Array.from({length:25}, () => ({identifier:'boat-' + serial++, title:'A rowing boat on water'}));
      const data = {response:{numFound:project === 'dreamachine' ? 25 : 50000, docs}};
      return route.fulfill({contentType:callback ? 'text/javascript' : 'application/json', headers:{'Access-Control-Allow-Origin':'*'}, body:callback ? callback + '(' + JSON.stringify(data) + ')' : JSON.stringify(data)});
    });
    await context.route('https://archive.org/metadata/**', route => route.fulfill({
      headers:{'Access-Control-Allow-Origin':'*'},
      json:{ metadata:{title:'A rowing boat on water — unedited home movie',collection:['prelinger'],date:'1955',creator:'fixture'},files:[
        {name:'boat.mp4',size:317357,length:60,height:240,format:'512Kb MPEG4'},
        {name:'boat.thumbs/boat_000005.jpg'},
      ]},
    }));
    await context.route('https://archive.org/download/**', route => route.fulfill({contentType:'video/mp4',body:fixture}));
    const png = Buffer.from(await page.evaluate(() => { const c=document.createElement('canvas');c.width=16;c.height=16;c.getContext('2d').fillRect(0,0,16,16);return c.toDataURL('image/png').split(',')[1]; }), 'base64');
    await context.route('https://archive.org/services/img/**', route => route.fulfill({contentType:'image/png',body:png}));
    await context.route('https://archive.org/cors/**', route => route.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:png}));
    const url = local ? pathToFileURL(resolve(root, project + '-local/index.html')).href : 'http://127.0.0.1:' + server.address().port + '/' + project + '/index.html';
    await page.goto(url);
    console.log('OPEN', url);
    try { await page.waitForFunction(() => !!document.querySelector('video.on'), null, {timeout:20000}); }
    catch(error) {
      await page.keyboard.press('i');
      console.log(await page.locator('#info').innerText());
      console.log(await page.locator('video').evaluateAll(videos => videos.map(v => ({src:v.src,error:v.error?.message,ready:v.readyState,duration:v.duration,buffer:v.buffered.length}))));
      throw error;
    }
    await page.keyboard.press('i');
    try { await page.waitForFunction(() => document.querySelector('#info').textContent.includes('catena in entrata'), null, {timeout:15000}); }
    catch(error) { console.log(await page.locator('#info').innerText()); throw error; }
    assert.equal(await page.locator('#launch').count(),0);
    assert.ok(await page.locator('#info mark').count() > 0);
    await page.keyboard.press('c');
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('video.on').evaluate(v => getComputedStyle(v).objectFit), 'cover');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(document.title + ':chain:v1')));
    assert.ok(saved.some(record => record.description && record.successor?.matchTerms.length));
    const download = page.waitForEvent('download'); await page.keyboard.press('s'); assert.ok((await download).suggestedFilename().endsWith('.json'));
    await page.locator('#skipArea').click();
    assert.equal(await page.locator('video.on').evaluate(v => v.muted), false, 'first click enables audio');
    await page.keyboard.press('m');
    await page.locator('#skipArea').click();
    assert.equal(await page.locator('video.on').evaluate(v => v.muted), true, 'later clicks preserve mute');
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(errors, []);
    console.log('PASS', project, local ? 'file://' : 'http://', 'video → worker → keyword → titolo, cronologia, export, fit/fill');
    if (project === 'afterimage' && !local) {
      holdCaption = true;
      await page.addInitScript(() => {
        const base=performance.now(); window.__elapsed=0; performance.now=()=>base+window.__elapsed;
        const descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'duration');
        Object.defineProperty(HTMLMediaElement.prototype,'duration',{get(){const value=descriptor.get.call(this);return Number.isFinite(value)?Math.max(60,value):value;}});
      });
      await page.reload();
      await page.waitForFunction(() => !!document.querySelector('video.on'));
      await page.keyboard.press('i');
      await page.waitForFunction(() => document.querySelector('#info').textContent.includes('2 casuali pronti'));
      const previous=await page.locator('video.on').getAttribute('src');
      await page.evaluate(()=>{window.__elapsed+=29000;document.querySelector('video.on').currentTime+=.1;});
      await page.waitForTimeout(200);
      assert.equal(await page.locator('video.on').getAttribute('src'),previous, 'random reserve should not interrupt before the cap');
      await page.evaluate(()=>{window.__elapsed+=2000;document.querySelector('video.on').currentTime+=.1;});
      await page.waitForFunction(old=>document.querySelector('video.on')?.getAttribute('src')!==old,previous);
      console.log('PASS', 'limite assoluto 30s: fallback senza estensione');
    }
    await context.close();
  }
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
