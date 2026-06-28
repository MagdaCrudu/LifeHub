// Static server + file-storage API for LifeHub.
// Serves the app and persists data as editable JSON files in ../data_storage/.
// Usage: node tools/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data_storage');
const COLLECTIONS = ['credits', 'notes', 'recipes', 'expenses', 'savings']; // user data (read + write)
const READ_ONLY = ['ircc'];                                                  // reference data (read only)
const PORT = +process.argv[2] || 5173;

fs.mkdirSync(DATA_DIR, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function readAll() {
  const out = {};
  const errors = [];
  for (const c of [...COLLECTIONS, ...READ_ONLY]) {
    const f = path.join(DATA_DIR, c + '.json');
    try {
      if (fs.existsSync(f)) out[c] = JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) {
      errors.push(`${c}.json: ${e.message}`);
    }
  }
  if (errors.length) out.__errors = errors;
  return out;
}

function writeAll(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const c of COLLECTIONS) {
    if (Array.isArray(data[c])) {
      fs.writeFileSync(path.join(DATA_DIR, c + '.json'), JSON.stringify(data[c], null, 2) + '\n');
    }
  }
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // ---- API ----
  if (urlPath === '/api/data') {
    if (req.method === 'GET') return sendJSON(res, 200, readAll());
    if (req.method === 'PUT' || req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 20 * 1024 * 1024) req.destroy(); });
      req.on('end', () => {
        try { writeAll(JSON.parse(body || '{}')); sendJSON(res, 200, { ok: true, dir: DATA_DIR }); }
        catch (e) { sendJSON(res, 400, { ok: false, error: e.message }); }
      });
      return;
    }
    res.writeHead(405); return res.end('Method not allowed');
  }
  // IRCC reference data: read + (explicit) write to ircc.json. Kept separate from /api/data
  // so a regular data save never touches it; only this endpoint rewrites the source file.
  if (urlPath === '/api/ircc') {
    if (req.method === 'GET') { const all = readAll(); return sendJSON(res, 200, { ircc: all.ircc || [] }); }
    if (req.method === 'PUT' || req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 5 * 1024 * 1024) req.destroy(); });
      req.on('end', () => {
        try {
          const arr = JSON.parse(body || '[]');
          if (!Array.isArray(arr)) throw new Error('Aștept un array de IRCC');
          const clean = arr
            .filter((e) => e && typeof e.trimestru === 'string' && /^\d{4}T[1-4]$/.test(e.trimestru) && isFinite(+e.value))
            .map((e) => ({ value: +e.value, trimestru: e.trimestru }));
          fs.mkdirSync(DATA_DIR, { recursive: true });
          fs.writeFileSync(path.join(DATA_DIR, 'ircc.json'), JSON.stringify(clean, null, 2) + '\n');
          sendJSON(res, 200, { ok: true, count: clean.length });
        } catch (e) { sendJSON(res, 400, { ok: false, error: e.message }); }
      });
      return;
    }
    res.writeHead(405); return res.end('Method not allowed');
  }
  if (urlPath === '/api/info') {
    return sendJSON(res, 200, { storage: 'files', dir: DATA_DIR, collections: COLLECTIONS });
  }

  // ---- static ----
  let p = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT, path.normalize(p));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`LifeHub → http://localhost:${PORT}`);
  console.log(`Datele se salvează în: ${DATA_DIR}`);
});
