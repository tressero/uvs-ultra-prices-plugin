/**
 * Build the extension.
 *
 *   node build.mjs          -> dist/      (production, no dev hooks)
 *   node build.mjs --dev    -> dist-dev/  (adds localhost matches + in-page fallback)
 *
 * Content scripts and the popup are bundled as IIFEs (MV3 content scripts are
 * not modules); the service worker is bundled too, so `sw.js` has no imports at
 * runtime.
 */
import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const outdir = join(ROOT, dev ? 'dist-dev' : 'dist');
const SRC = join(ROOT, 'extension', 'src');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const result = await esbuild.build({
  entryPoints: {
    deck: join(SRC, 'content', 'deck.js'),
    popup: join(SRC, 'popup', 'popup.js'),
    sw: join(SRC, 'background', 'sw.js'),
  },
  outdir,
  bundle: true,
  format: 'iife',
  target: ['chrome114'],
  define: { __DEV__: JSON.stringify(dev) },
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

// Manifest, with the dev-only matches injected in --dev builds.
const manifest = JSON.parse(await readFile(join(SRC, 'manifest.json'), 'utf8'));
if (dev) {
  manifest.content_scripts[0].matches.push('http://localhost:8787/*');
  manifest.host_permissions.push('http://localhost:8787/*');
}
await writeFile(join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const sizes = Object.entries(result.metafile.outputs)
  .filter(([file]) => file.endsWith('.js'))
  .map(([file, info]) => `${file.split('/').pop()} ${(info.bytes / 1024).toFixed(0)} KB`);

console.log(`\nbuilt ${dev ? 'dist-dev' : 'dist'}: ${sizes.join(', ')}`);
