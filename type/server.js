// Avvia con: node server.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dataPath = path.join(root, 'presets.json');
const port = Number(process.env.PORT || 4177);

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return { version: 1, current: data.current || null, presets: data.presets || {} };
  } catch {
    return { version: 1, current: null, presets: {} };
  }
}

function writeData(data) {
  const tempPath = path.join(root, 'presets.json.tmp');
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, dataPath);
}

function respond(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.on('data', chunk => {
      text += chunk;
      if (text.length > 2_000_000) reject(new Error('Richiesta troppo grande'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(text)); } catch { reject(new Error('JSON non valido')); }
    });
    req.on('error', reject);
  });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      fs.createReadStream(path.join(root, 'index.html')).pipe(res);
      return;
    }
    if (req.method === 'GET' && (url.pathname === '/api/state' || url.pathname === '/presets.json')) {
      respond(res, 200, readData());
      return;
    }
    if (req.method === 'PUT' && url.pathname === '/api/current') {
      const state = await body(req);
      if (!state || typeof state !== 'object' || Array.isArray(state)) return respond(res, 400, { error: 'Stato non valido' });
      const data = readData();
      data.current = state;
      writeData(data);
      return respond(res, 200, { saved: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/preset') {
      const input = await body(req);
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!name || name.length > 80 || !input.state || typeof input.state !== 'object') return respond(res, 400, { error: 'Nome o preset non valido' });
      const data = readData();
      data.presets[name] = input.state;
      writeData(data);
      return respond(res, 200, { saved: true, names: Object.keys(data.presets) });
    }
    respond(res, 404, { error: 'Non trovato' });
  } catch (error) {
    respond(res, 500, { error: error.message });
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Type Disorder: http://127.0.0.1:${port}/`);
  console.log(`Preset salvati in ${dataPath}`);
});
