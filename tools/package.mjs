/**
 * Package dist/ into a Chrome Web Store upload.
 *
 *   npm run package
 *
 * The zip must have manifest.json at its root — a nested dist/ folder is the
 * most common reason an upload is rejected.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ZIP = join(ROOT, 'dist.zip');

if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error('dist/manifest.json is missing — run `npm run build` first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

if (manifest.version !== version) {
  console.error(`version mismatch: manifest ${manifest.version} vs package.json ${version}`);
  process.exit(1);
}

const placeholder = /example\.workers\.dev/.test(
  JSON.parse(readFileSync(join(ROOT, 'config', 'worker.json'), 'utf8')).url,
);
if (placeholder) {
  console.error('config/worker.json still points at the placeholder URL — deploy first.');
  process.exit(1);
}

if (existsSync(ZIP)) unlinkSync(ZIP);

execFileSync('zip', ['-r', '-q', '-X', ZIP, '.', '-x', '.DS_Store'], { cwd: DIST });

const entries = execFileSync('unzip', ['-l', ZIP]).toString();
const count = entries.split('\n').filter((line) => line.includes('dist/') || line.trim().endsWith('.json')).length;
const kb = statSync(ZIP).size / 1024;

console.log(`dist.zip  ${kb.toFixed(0)} KB  v${version}`);
console.log(entries.split('\n').slice(3, 12).join('\n'));
if (!/manifest\.json/.test(execFileSync('unzip', ['-l', ZIP]).toString())) {
  console.error('manifest.json is not at the root of the zip');
  process.exit(1);
}
