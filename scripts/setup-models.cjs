// scripts/setup-models.cjs — recreate public/models junction/symlink to ../3D models
const fs = require('node:fs');
const path = require('node:path');
const target = path.resolve(__dirname, '..', '3D models');
const link = path.resolve(__dirname, '..', 'public', 'models');
if (!fs.existsSync(target)) {
  console.error(`[setup-models] source folder missing: ${target}`);
  process.exit(1);
}
try { fs.rmSync(link, { recursive: true, force: true, maxRetries: 3 }); } catch {}
fs.mkdirSync(path.dirname(link), { recursive: true });
const type = process.platform === 'win32' ? 'junction' : 'dir';
fs.symlinkSync(target, link, type);
console.log(`[setup-models] linked ${link} -> ${target}`);
