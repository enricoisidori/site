import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const transport = readFileSync(resolve(root, 'afterimage/archive-transport.js'), 'utf8').replace(/^export /gm, '');
const flow = readFileSync(resolve(root, 'tools/image-flow.js'), 'utf8');
const code = '(() => {\n"use strict";\n' + transport + '\n' + flow + '\n})();';
new vm.Script(code);
writeFileSync(resolve(root, 'image.html'), `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>image</title><link rel="icon" href="data:,"><style>
html,body,main{margin:0;width:100%;height:100%;overflow:hidden;background:white}
main{position:fixed;inset:0}
img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none}
</style></head><body><main aria-label="immagini internet archive"></main><script>
${code.replace(/<\/script/gi, '<\\/script')}
</script></body></html>\n`);
console.log('image.html');
