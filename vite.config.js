import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '3D models');

// Bridges the out-of-tree "3D models/" folder to the URL path /models/*.
//
// - In dev (`vite`): an HTTP middleware streams the files directly. Avoids relying on a
//   junction at public/models which behaved inconsistently on Windows.
// - In build (`vite build`): a writeBundle hook copies every file into dist/models/, so the
//   production bundle is fully self-contained and any static host (Render, Netlify, GH Pages)
//   serves them at the same /models/* URLs without extra config.
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
  // Copy all GLBs into dist/models/ so production deploys ship the assets.
  writeBundle(outputOptions) {
    const outDir = outputOptions.dir || path.resolve(__dirname, 'dist');
    const destDir = path.join(outDir, 'models');
    if (!fs.existsSync(ASSETS_DIR)) {
      this.warn(`serve-3d-models: source folder missing at ${ASSETS_DIR} — nothing to copy.`);
      return;
    }
    fs.mkdirSync(destDir, { recursive: true });
    let copied = 0;
    for (const entry of fs.readdirSync(ASSETS_DIR, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      fs.copyFileSync(path.join(ASSETS_DIR, entry.name), path.join(destDir, entry.name));
      copied += 1;
    }
    this.info(`serve-3d-models: copied ${copied} model file(s) → ${path.relative(__dirname, destDir)}`);
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
