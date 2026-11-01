/**
 * Package a dist/ folder into a store upload and a versioned manual-install zip.
 *
 *   npm run package            -> dist-<label>.zip + dist.zip         (Chrome)
 *   npm run package:firefox    -> dist-firefox-<label>.zip + dist-firefox.zip (AMO)
 *
 * Both have manifest.json at the root — a nested dist/ folder is the most common
 * reason an upload is rejected.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInfo, readVersion } from './lib/version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const firefox = process.argv.includes('--firefox');
const DIST = join(ROOT, firefox ? 'dist-firefox' : 'dist');
const distName = firefox ? 'dist-firefox' : 'dist';

if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error(`${distName}/manifest.json is missing — run \`npm run build${firefox ? ':firefox' : ''}\` first.`);
  process.exit(1);
}

const version = readVersion(ROOT);
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const versionFile = readFileSync(join(DIST, 'version.txt'), 'utf8').trim();

if (manifest.version !== version) {
  console.error(`version mismatch: manifest ${manifest.version} vs VERSION.txt ${version}`);
  process.exit(1);
}
if (pkg.version !== version) {
  console.error(`version mismatch: package.json ${pkg.version} vs VERSION.txt ${version}`);
  process.exit(1);
}
if (!firefox && !versionFile.startsWith(`${version}.`)) {
  console.error(`${distName}/version.txt is ${versionFile}, expected ${version}.<commit>`);
  process.exit(1);
}
if (firefox && versionFile !== version) {
  console.error(`${distName}/version.txt is ${versionFile}, expected ${version} for the reproducible AMO build`);
  process.exit(1);
}

if (firefox) {
  const gecko = manifest.browser_specific_settings?.gecko;
  if (!gecko?.id) {
    console.error('Firefox manifest is missing browser_specific_settings.gecko.id');
    process.exit(1);
  }
  if (!gecko.data_collection_permissions?.required?.length) {
    console.error('Firefox manifest is missing data_collection_permissions.required');
    process.exit(1);
  }
  if (manifest.background?.service_worker || !manifest.background?.scripts?.includes('sw.js')) {
    console.error('Firefox manifest must use background.scripts (no service_worker)');
    process.exit(1);
  }
}

const placeholder = /example\.workers\.dev/.test(
  JSON.parse(readFileSync(join(ROOT, 'config', 'worker.json'), 'utf8')).url,
);
if (placeholder) {
  console.error('config/worker.json still points at the placeholder URL — deploy first.');
  process.exit(1);
}

// The Firefox build itself is deterministic; only the archive name carries the
// commit so a release can be traced back to its source.
const label = firefox ? buildInfo(ROOT).label : versionFile;
const releaseZip = join(ROOT, firefox ? `dist-firefox-${label}.zip` : `dist-${label}.zip`);
const storeZip = join(ROOT, firefox ? 'dist-firefox.zip' : 'dist.zip');
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
console.log(`${releaseZip.split('/').pop()}  ${kb.toFixed(0)} KB  v${version}`);
console.log(`${storeZip.split('/').pop()}  stable alias for the ${firefox ? 'AMO' : 'Chrome Web Store'} upload`);
console.log(entries.split('\n').slice(3, 12).join('\n'));
