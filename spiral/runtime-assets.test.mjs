import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
test('all local runtime module and URL references resolve to shipped files',async()=>{
 for(const filename of await readdir(new URL('.',import.meta.url))) {
  if(!filename.endsWith('.js'))continue;
  const source=await readFile(new URL(filename,import.meta.url),'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\(\s*|new URL\(\s*)['"](\.\/[^'"]+)['"]/g)) {
   const target=new URL(match[1],new URL(filename,import.meta.url));
   target.search='';
   assert.ok((await stat(target)).isFile(),`${filename}: ${match[1]}`);
  }
 }
});
