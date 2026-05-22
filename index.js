// Tiny zero-dependency static-file server for Render's default
// `node index.js` start command. Serves the Vite-built dist/ folder
// (which contains the bundle AND every /models/*.glb thanks to the
// build-time copy hook in vite.config.js).
//
// The build itself runs during `npm install` via the "postinstall"
// script in package.json — so by the time this file runs on Render,
// dist/ already exists.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

if (!existsSync(DIST)) {
  console.error(`[server] No dist/ folder at ${DIST}.`);
  console.error('[server] Run "npm run build" before "node index.js" (or rely on the postinstall hook in package.json).');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
};

async function tryFile(p) {
  try { const s = await stat(p); return s.isFile() ? s : null; }
  catch { return null; }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    let filePath = path.normalize(path.join(DIST, pathname));
    if (!filePath.startsWith(DIST)) { res.writeHead(403); return res.end('Forbidden'); }

    let info = await tryFile(filePath);
    // SPA fallback: any unmatched extension-less route → index.html.
    if (!info && !path.extname(pathname)) {
      filePath = path.join(DIST, 'index.html');
      info = await tryFile(filePath);
    }
    if (!info) { res.writeHead(404); return res.end('Not Found'); }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const body = await readFile(filePath);

    const isImmutable = /^\/(models|assets)\//.test(pathname);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': body.length,
      'Cache-Control': isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch (err) {
    console.error('[server]', err);
    res.writeHead(500);
    res.end('Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] serving ${DIST} on http://${HOST}:${PORT}`);
});
