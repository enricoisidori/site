const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = __dirname;
const port = Number(process.env.PORT || 4178);
const projectPath = path.join(root, 'project.json');
const localFonts = path.join(os.homedir(), 'Library', 'Fonts');
const files = { '/': ['index.html','text/html'], '/index.html': ['index.html','text/html'], '/style.css': ['style.css','text/css'], '/app.js': ['app.js','text/javascript'] };

http.createServer((req,res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const exposure = pathname.match(/^\/fonts\/exposure\/(-100|-?\d{1,2}|100)\.otf$/);
  const ortica = pathname.match(/^\/fonts\/ortica\/(light|regular|bold)\.otf$/);
  if (req.method === 'GET' && (exposure || ortica)) {
    const value = exposure ? Number(exposure[1]) : null;
    if (exposure && (value % 10 !== 0 || value < -100 || value > 100)) { res.writeHead(404);res.end();return; }
    const filename = exposure ? `ExposureTrial[${value>0?'+'+value:value}].otf` : `OrticaLinear-${ortica[1][0].toUpperCase()+ortica[1].slice(1)}.otf`;
    const fontPath = path.join(localFonts, filename);
    if (!fs.existsSync(fontPath)) { res.writeHead(404);res.end('Font non trovato');return; }
    res.writeHead(200, { 'Content-Type':'font/otf', 'Cache-Control':'private, max-age=3600' });
    fs.createReadStream(fontPath).pipe(res);
    return;
  }
  if (req.method === 'GET' && files[pathname]) {
    const [name,type] = files[pathname];
    res.writeHead(200, {'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store'});
    fs.createReadStream(path.join(root,name)).pipe(res);
    return;
  }
  if (req.method === 'GET' && pathname === '/api/project') {
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
    res.end(fs.readFileSync(projectPath,'utf8'));
    return;
  }
  if ((req.method === 'PUT' || req.method === 'POST') && pathname === '/api/project') {
    let body='';
    req.on('data',chunk=>{body+=chunk;if(body.length>2_000_000)req.destroy()});
    req.on('end',()=>{
      try {
        const current=JSON.parse(body);
        if(!current||!Array.isArray(current.layers))throw Error('Progetto non valido');
        const temp=path.join(root,'project.json.tmp');
        fs.writeFileSync(temp,JSON.stringify({version:1,current},null,2)+'\n');
        fs.renameSync(temp,projectPath);
        res.writeHead(200,{'Content-Type':'application/json'});res.end('{"saved":true}');
      } catch(error) {res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}))}
    });
    return;
  }
  res.writeHead(404);res.end('Non trovato');
}).listen(port,'127.0.0.1',()=>console.log(`Linear Layers: http://127.0.0.1:${port}/`));
