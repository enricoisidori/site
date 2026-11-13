import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('a cancelled loading fade cannot cancel or hide the next fade',async()=>{
 const animations=[],overlay={hidden:false,classList:{add(){},remove(){}},setAttribute(){},animate(){let resolve,reject;const animation={cancelled:false,finished:new Promise((a,b)=>{resolve=a;reject=b;}),complete(){resolve();},cancel(){this.cancelled=true;reject(new Error('cancelled'));}};animations.push(animation);return animation;}},picture={getAttribute:()=>null};
 const sandbox={AbortController,performance,setTimeout,clearTimeout,matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:s=>s==='#loading'?overlay:s==='.loading-picture'?picture:{innerHTML:''}}};vm.createContext(sandbox);
 const source=readFileSync(new URL('../loading.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 vm.runInContext("const loadingArt='';const archiveJSON=async()=>({response:{docs:[]}});\n"+source+'\nglobalThis.api={finishLoading,setWaiting};',sandbox);
 await sandbox.api.finishLoading();const first=sandbox.api.setWaiting(false);sandbox.api.setWaiting(true);await sandbox.api.finishLoading();const second=sandbox.api.setWaiting(false);
 await first;assert.equal(animations[1].cancelled,false);assert.equal(overlay.hidden,false);animations[1].complete();await second;assert.equal(overlay.hidden,true);
});
