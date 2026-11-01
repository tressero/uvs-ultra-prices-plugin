/**
 * Build the extension.
 *
 *   node build.mjs                  -> dist/          (Chrome, production)
 *   node build.mjs --dev            -> dist-dev/      (adds localhost matches + in-page fallback)
 *   node build.mjs --firefox        -> dist-firefox/  (Firefox/AMO, production)
 *   node build.mjs --firefox --dev  -> dist-firefox-dev/
 *
 * The pricing worker URL comes from config/worker.json (or the WORKER_URL
 * environment variable) and is baked into two places: the default in the
 * background script and the host permission in the manifest.
 *
 * The Firefox build deliberately leaves the commit out of the bundle and
 * version.txt. AMO rebuilds the submitted source and compares the result, so
 * the built files must not depend on local git metadata. The commit still
 * names the GitHub release tag and the zip file.
 */
import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeManifest, hostPermissionsFor } from './tools/lib/manifest.mjs';
import { buildInfo, readVersion } from './tools/lib/version.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const firefox = process.argv.includes('--firefox');
const outName = firefox ? (dev ? 'dist-firefox-dev' : 'dist-firefox') : dev ? 'dist-dev' : 'dist';
const outdir = join(ROOT, outName);
const SRC = join(ROOT, 'extension', 'src');

const version = readVersion(ROOT);
const info = buildInfo(ROOT);
const label = firefox ? version : info.label;
const dirty = info.dirty;
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
if (pkg.version !== version) {
  throw new Error(`package.json is ${pkg.version}, VERSION.txt is ${version} — keep them in sync`);
}

const workerConfig = JSON.parse(await readFile(join(ROOT, 'config', 'worker.json'), 'utf8'));
const workerUrl = (process.env.WORKER_URL || workerConfig.url).trim();
if (!/^https?:\/\//.test(workerUrl)) {
  throw new Error(`config/worker.json must hold an http(s) URL, got: ${workerUrl}`);
}
const workerOrigin = new URL(workerUrl).origin;
const isPlaceholder = /example\.workers\.dev/.test(workerUrl);
if (!dev && isPlaceholder) {
  console.warn(
    '\n!! config/worker.json still holds the placeholder URL.\n' +
      '   Deploy the worker, put its URL in config/worker.json, then rebuild before shipping.\n',
  );
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const result = await esbuild.build({
  entryPoints: {
    deck: join(SRC, 'content', 'deck.js'),
    list: join(SRC, 'content', 'list.js'),
    cards: join(SRC, 'content', 'cards.js'),
    popup: join(SRC, 'popup', 'popup.js'),
    sw: join(SRC, 'background', 'sw.js'),
  },
  outdir,
  bundle: true,
  format: 'iife',
  target: [firefox ? 'firefox140' : 'chrome114'],
  define: {
    __DEV__: JSON.stringify(dev),
    __WORKER_URL__: JSON.stringify(workerUrl),
    __APP_VERSION__: JSON.stringify(version),
    __APP_VERSION_LABEL__: JSON.stringify(label),
    __GIT_COMMIT__: JSON.stringify(firefox ? '' : info.short),
    __GIT_COMMIT_FULL__: JSON.stringify(firefox ? '' : info.full || ''),
    __GIT_COMMIT_URL__: JSON.stringify(firefox ? '' : info.commitUrl || ''),
  },
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  logLevel: 'info',
  metafile: true,
});

// Static assets.
await cp(join(SRC, 'content', 'content.css'), join(outdir, 'content.css'));
await cp(join(SRC, 'popup', 'popup.html'), join(outdir, 'popup.html'));
await cp(join(SRC, 'popup', 'popup.css'), join(outdir, 'popup.css'));
await cp(join(SRC, 'icons'), join(outdir, 'icons'), { recursive: true });

// Offline fallback: one JSON file the background script loads only if the pricing
// worker is unreachable, so it never inflates the bundled background script.
const snapshot = JSON.parse(await readFile(join(ROOT, 'data', 'prices.snapshot.json'), 'utf8'));
const setMap = JSON.parse(await readFile(join(ROOT, 'data', 'set-map.json'), 'utf8'));
await writeFile(
  join(outdir, 'catalog.json'),
  JSON.stringify({
    setMap,
    groups: snapshot.groups,
    updatedAt: snapshot.generatedAt ?? null,
    source: snapshot.source ?? null,
  }),
);

const baseManifest = JSON.parse(await readFile(join(SRC, 'manifest.json'), 'utf8'));
const overlay = firefox
  ? JSON.parse(await readFile(join(SRC, 'manifest.firefox.json'), 'utf8'))
  : {};
const hostPermissions = hostPermissionsFor(baseManifest, { workerOrigin, dev });
// One source of truth for the version: VERSION.txt (the Chrome build label adds the commit).
const manifest = composeManifest(baseManifest, overlay, { version, hostPermissions });

if (dev) {
  for (const entry of manifest.content_scripts) {
    if (!entry.matches.includes('http://localhost:8787/*')) entry.matches.push('http://localhost:8787/*');
  }
}

await writeFile(join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(join(outdir, 'version.txt'), `${label}\n`);

const sizes = Object.entries(result.metafile.outputs)
  .filter(([file]) => file.endsWith('.js'))
  .map(([file, info]) => `${file.split('/').pop()} ${(info.bytes / 1024).toFixed(0)} KB`);

console.log(`\nbuilt ${outName}: ${sizes.join(', ')}`);
console.log(`target: ${firefox ? 'Firefox 140+' : 'Chrome'}`);
console.log(`version: ${label}${dirty ? ' (dirty tree)' : ''}`);
if (info.commitUrl) console.log(`commit:  ${info.commitUrl}`);
console.log(`pricing worker: ${workerUrl}`);

