// Generate file:// editions from online sources; users never run this script.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const project of (process.argv[2] ? [process.argv[2]] : ['afterimage', 'dreamachine'])) {
  const source = resolve(root, project), modules = new Map();
  // Inline artwork also works under file://, without SVG mask CORS requests.
  const artwork = readFileSync(resolve(source, 'afterimage.svg'), 'utf8')
    .replace(/<rect[^>]+fill="white"[^>]*\/>/, '')
    .replaceAll('fill="black"', 'fill="currentColor"');
  writeFileSync(resolve(source, 'loading-art.js'), `export const loadingArt = ${JSON.stringify(artwork)};\n`);
  function pack(filename) {
    if (modules.has(filename)) return;
    let code = readFileSync(resolve(source, filename), 'utf8');
    const dependencies = [];
    code = code.replace(/^import\s+\{([^}]+)\}\s+from\s+'\.\/([^']+)';\s*$/gm, (_, bindings, dependency) => {
      dependencies.push(dependency);
      return `const {${bindings.replace(/\s+as\s+/g, ':')}} = modules[${JSON.stringify(dependency)}];`;
    });
    const names = [];
    code = code.replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][\w$]*))/gm, (_, name) => {
      names.push(name); return '';
    });
    if (filename === 'app.js') {
      const worker = readFileSync(resolve(source, 'vision-worker.js'), 'utf8');
      const old = "worker = new Worker(new URL('./vision-worker.js', import.meta.url), { type: 'module' });";
      if (!code.includes(old)) throw new Error('Update the local worker adapter');
      // Classic Blob workers support dynamic import and avoid the file://
      // module-worker redirect restriction. Explicit CDN file avoids redirects.
      code = code.replace(old, `const workerURL = URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: 'text/javascript' }));
      worker = new Worker(workerURL);
      URL.revokeObjectURL(workerURL);`);
    }
    if (/^\s*(?:import\s+(?!\()|export\s+)/m.test(code) || code.includes('import.meta')) throw new Error('Unsupported module: ' + filename);
    for (const dependency of dependencies) pack(dependency);
    modules.set(filename, `modules[${JSON.stringify(filename)}] = (() => {\n${code}\nreturn {${names.join(',')}};\n})();`);
  }
  pack('app.js');
  const script = '(() => {\n"use strict";\nconst modules = Object.create(null);\n' + [...modules.values()].join('\n') + '\n})();';
  new vm.Script(script, { filename: project + '-local.js' });
  let html = readFileSync(resolve(source, 'index.html'), 'utf8');
  html = html.replace(/<link rel="stylesheet"[^>]+>/, () => '<style>\n' + readFileSync(resolve(source, 'style.css'), 'utf8') + '\n</style>');
  html = html.replace(/<script type="module"[^>]+><\/script>/, () => '<script>\n' + script.replace(/<\/script/gi, '<\\/script') + '\n</script>');
  const output = resolve(root, project + '-local'); mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'index.html'), html);
  copyFileSync(resolve(source, 'afterimage.svg'), resolve(output, 'afterimage.svg'));
  console.log(project + '-local/index.html');
}
