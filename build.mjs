/**
 * Build the extension.
 *
 *   node build.mjs                 -> dist/      (production)
 *   node build.mjs --dev           -> dist-dev/  (adds localhost matches + in-page fallback)
 *   WORKER_URL=http://localhost:8789 node build.mjs --dev
 *
 * The pricing worker URL comes from config/worker.json (or the WORKER_URL
 * environment variable) and is baked into two places: the default in the
 * service worker and the host permission in the manifest.
 */
import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInfo, readVersion } from './tools/lib/version.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const outdir = join(ROOT, dev ? 'dist-dev' : 'dist');
const SRC = join(ROOT, 'extension', 'src');

const version = readVersion(ROOT);
const { label, short, full, commitUrl, dirty } = buildInfo(ROOT);
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
  target: ['chrome114'],
  define: {
    __DEV__: JSON.stringify(dev),
    __WORKER_URL__: JSON.stringify(workerUrl),
    __APP_VERSION__: JSON.stringify(version),
    __APP_VERSION_LABEL__: JSON.stringify(label),
    __GIT_COMMIT__: JSON.stringify(short),
    __GIT_COMMIT_FULL__: JSON.stringify(full || ''),
    __GIT_COMMIT_URL__: JSON.stringify(commitUrl || ''),
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

// Offline fallback: one JSON file the service worker loads only if the pricing
// worker is unreachable, so it never inflates the bundled service worker.
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

const manifest = JSON.parse(await readFile(join(SRC, 'manifest.json'), 'utf8'));
// One source of truth for the version: VERSION.txt (the build label adds the commit).
manifest.version = version;

// Only the origin the extension actually talks to gets a host permission.
const permissions = new Set([...manifest.host_permissions, `${workerOrigin}/*`]);
if (dev) permissions.add('http://localhost:8787/*');
manifest.host_permissions = [...permissions];

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

console.log(`\nbuilt ${dev ? 'dist-dev' : 'dist'}: ${sizes.join(', ')}`);
console.log(`version: ${label}${dirty ? ' (dirty tree)' : ''}`);
if (commitUrl) console.log(`commit:  ${commitUrl}`);
console.log(`pricing worker: ${workerUrl}`);
