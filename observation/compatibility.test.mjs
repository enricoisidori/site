import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
test('standalone HTML has no local module or worker dependency',()=>{
 assert.doesNotMatch(html, /<script[^>]+src=/);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,2);
 const worker=JSON.parse(scripts[0][1]);
 assert.equal(worker,readFileSync(new URL('./vision-worker.js',import.meta.url),'utf8'));
 new Script(scripts[1][1]);
 assert.doesNotMatch(scripts[1][1],/new Worker\(["']\.\//);
});
function context(storage){
 const element={textContent:'',innerHTML:'',addEventListener(){}};
 return createContext({document:{querySelector(){return {...element}},addEventListener(){}},sessionStorage:storage,URL,Set,performance:{now:()=>0}});
}
const init=app.slice(0,app.lastIndexOf('\ntry {'));
test('blocked or corrupt storage cannot prevent startup',()=>{
 for(const storage of [{getItem(){throw Error('SecurityError')},setItem(){throw Error('SecurityError')}},{getItem(){return '{broken'},setItem(){}}]){
 const c=context(storage);new Script(init+'\nsaveSeen();if(seen.size!==0)throw Error("bad seen");').runInContext(c);
 }
});
test('metadata validation matches whole words and excludes unrelated text',()=>{
 const c=context({getItem:()=>null});
 new Script(init+'\nterms=["boat"];if(!score({title:"A boat on a lake"}).total)throw Error("missing match");if(score({title:"boathouse"}).total)throw Error("false match");').runInContext(c);
});
