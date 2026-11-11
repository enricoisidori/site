const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const file=await readFile(new URL('./fixture.mp4',import.meta.url));
for(const [name,url] of [['online',process.env.RELAY_URL || 'http://127.0.0.1:8099/afterimage/'],['local',new URL('../../afterimage-local/index.html',import.meta.url).href]]){
 const page=await browser.newPage();let serial=0;const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{window.Worker=class{postMessage(d){setTimeout(()=>this.onmessage?.({data:d.type==='warmup'?{id:d.id,ready:true}:{id:d.id,caption:'a rowing boat on water',inferenceMs:25}}),d.type==='warmup'?40:1500)}terminate(){}}});
 await page.route('https://archive.org/advancedsearch.php?**',route=>{const u=new URL(route.request().url()),data={response:{numFound:120000,docs:Array.from({length:50},()=>({identifier:'boat-'+serial++,title:'a rowing boat on water'}))}};const cb=u.searchParams.get('callback');return route.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{json:data});});
 await page.route('https://archive.org/metadata/**',route=>{const u=new URL(route.request().url()),id=u.pathname.split('/').pop(),data={metadata:{title:'a rowing boat on water '+id,collection:['opensource_movies'],creator:'fixture',subject:['boat','water']},files:[{name:'boat.mp4',size:317357,length:32,height:240}]};const cb=u.searchParams.get('callback');return route.fulfill(cb?{contentType:'text/javascript',body:cb+'('+JSON.stringify(data)+')'}:{json:data});});
 await page.route('https://archive.org/cors/**/*.mp4',route=>route.fulfill({contentType:'video/mp4',headers:{'Access-Control-Allow-Origin':'*'},body:file}));
 await page.goto(url);await page.waitForFunction(()=>window.afterimageStatus?.recordCount>=2&&!window.afterimageStatus.switching,{},{timeout:45000});
 await page.waitForTimeout(900);await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>window.afterimageStatus.reviewing&&!window.afterimageStatus.switching);await page.keyboard.press('i');await page.waitForTimeout(850);
 console.log(name,await page.evaluate(()=>({state:window.afterimageStatus.step,frames:document.querySelectorAll('#info img').length,underlines:document.querySelectorAll('#info u').length})),errors);
 if(requests.some(u=>u.includes('exceljs')))throw Error('Excel loaded early');
 const json=page.waitForEvent('download');await page.keyboard.press('s');await(await json).saveAs('/private/tmp/afterimage-'+name+'.json');const pdf=page.waitForEvent('download');await page.keyboard.press('p');await(await pdf).saveAs('/private/tmp/afterimage-'+name+'.pdf');
 if(name==='online'){const xlsx=page.waitForEvent('download',{timeout:60000});await page.keyboard.press('e');await(await xlsx).saveAs('/private/tmp/afterimage-test.xlsx');}
 if(errors.length)throw Error(errors.join('\n'));await page.close();
}await browser.close();
