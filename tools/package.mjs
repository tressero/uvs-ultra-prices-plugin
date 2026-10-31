/**
 * Package dist/ into a Chrome Web Store upload and a versioned manual-install zip.
 *
 *   npm run package
 *
 * Produces:
 *   dist-<label>.zip   versioned, attached to the GitHub release
 *   dist.zip           stable alias used by the Chrome Web Store upload
 *
 * Both have manifest.json at the root — a nested dist/ folder is the most common
 * reason an upload is rejected.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVersion } from './lib/version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error('dist/manifest.json is missing — run `npm run build` first.');
  process.exit(1);
}

const version = readVersion(ROOT);
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const label = readFileSync(join(DIST, 'version.txt'), 'utf8').trim();

if (manifest.version !== version) {
  console.error(`version mismatch: manifest ${manifest.version} vs VERSION.txt ${version}`);
  process.exit(1);
}
if (pkg.version !== version) {
  console.error(`version mismatch: package.json ${pkg.version} vs VERSION.txt ${version}`);
  process.exit(1);
}
if (!label.startsWith(`${version}.`)) {
  console.error(`dist/version.txt is ${label}, expected ${version}.<commit>`);
  process.exit(1);
}

const placeholder = /example\.workers\.dev/.test(
  JSON.parse(readFileSync(join(ROOT, 'config', 'worker.json'), 'utf8')).url,
);
if (placeholder) {
  console.error('config/worker.json still points at the placeholder URL — deploy first.');
  process.exit(1);
}

const releaseZip = join(ROOT, `dist-${label}.zip`);
const storeZip = join(ROOT, 'dist.zip');
for (const file of [releaseZip, storeZip]) {
  if (existsSync(file)) unlinkSync(file);
}

execFileSync('zip', ['-r', '-q', '-X', releaseZip, '.', '-x', '.DS_Store'], { cwd: DIST });
copyFileSync(releaseZip, storeZip);

for (const file of [releaseZip, storeZip]) {
  const entries = execFileSync('unzip', ['-l', file]).toString();
  if (!/manifest\.json/.test(entries)) {
    console.error(`manifest.json is not at the root of ${file}`);
    process.exit(1);
  }
}

const kb = statSync(releaseZip).size / 1024;
const entries = execFileSync('unzip', ['-l', releaseZip]).toString();
console.log(`dist-${label}.zip  ${kb.toFixed(0)} KB  v${label}`);
console.log("dist.zip           stable alias for the store upload");
console.log(entries.split('\n').slice(3, 12).join('\n'));
