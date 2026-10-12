import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const models=JSON.parse(readFileSync(resolve(root,'objects/models.json'),'utf8'));
const flow=readFileSync(resolve(root,'tools/object-flow.js'),'utf8');
const imports={imports:{three:'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js','three/addons/':'https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/'}};
writeFileSync(resolve(root,'leftover.html'),`<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>leftover</title><link rel="icon" href="data:,"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff;font-family:Helvetica,Arial,sans-serif}
canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}
#info{position:fixed;z-index:2;left:16px;bottom:16px;max-width:min(560px,calc(100vw - 64px));max-height:70vh;overflow:auto;background:rgba(255,255,255,.94);color:#222;padding:16px;font-size:12px;line-height:1.5;white-space:pre-line}
#info[hidden]{display:none}#info p{margin:0 0 10px}#info a{color:inherit}
</style><script type="importmap">${JSON.stringify(imports)}</script></head><body><aside id="info" hidden aria-label="fonti e informazioni"></aside><script type="module">
const MODEL_CATALOG=${JSON.stringify(models)};
${flow.replace(/<\/script/gi,'<\\/script')}
</script></body></html>\n`);
console.log('leftover.html · '+models.length+' CC0 models');
