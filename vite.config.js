import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '3D models');

// Explicit middleware for /models/* that streams files straight from "3D models/".
// We previously relied on a Windows junction at public/models, but the browser was getting
// Vite's SPA fallback HTML for those URLs (PowerShell GET worked fine — likely a browser
// cache or middleware-ordering quirk). Serving directly is more reliable cross-OS and
// makes the cache-control explicit.
const serveModelsPlugin = {
  name: 'serve-3d-models',
  configureServer(server) {
    server.middlewares.use('/models', (req, res, next) => {
      const rel = decodeURIComponent((req.url || '/').replace(/^\/+/, '').split('?')[0]);
      if (!rel) return next();
      const fullPath = path.normalize(path.join(ASSETS_DIR, rel));
      if (!fullPath.startsWith(ASSETS_DIR)) { res.writeHead(403).end(); return; }
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return next();
      res.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Content-Length': fs.statSync(fullPath).size,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(fullPath).pipe(res);
    });
  },
};

export default defineConfig({
  plugins: [serveModelsPlugin],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      allow: ['..', './3D models', '.'],
    },
  },
});
