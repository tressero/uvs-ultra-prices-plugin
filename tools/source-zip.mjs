/**
 * Build the source archive AMO reviewers use when the shipped code is bundled
 * and minified.
 *
 *   npm run source:firefox
 *
 * The archive contains only what `npm ci && npm run build-for-amo` needs:
 * the extension sources, the shared modules, the committed data/config files,
 * the build and packaging scripts, the lockfile and AMO-BUILD.md. Tests,
 * fixtures, screenshots and node_modules stay out.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInfo } from './lib/version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const entries = [
  '.nvmrc',
  'AMO-BUILD.md',
  'LICENSE',
  'VERSION.txt',
  'build.mjs',
  'config/worker.json',
  'data',
  'extension/src',
  'package-lock.json',
  'package.json',
  'shared',
  'tools/lib/manifest.mjs',
  'tools/lib/version.mjs',
  'tools/package.mjs',
];

for (const entry of entries) {
  if (!existsSync(join(ROOT, entry))) {
    console.error(`missing source entry: ${entry}`);
    process.exit(1);
  }
}

const label = buildInfo(ROOT).label;
const out = join(ROOT, `uvs-ultra-prices-source-${label}.zip`);
const staging = mkdtempSync(join(tmpdir(), 'uvsp-source-'));

try {
  for (const entry of entries) {
    const from = join(ROOT, entry);
    const to = join(staging, entry);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  }

  // The build does not use Playwright; skip its browser download in review
  // environments and keep the AMO builder's npm install small.
  writeFileSync(join(staging, '.npmrc'), 'playwright_skip_browser_download=1\n');

  rmSync(out, { force: true });
  execFileSync('zip', ['-r', '-q', '-X', out, '.', '-x', '.DS_Store'], { cwd: staging });

  const listing = execFileSync('unzip', ['-l', out]).toString();
  if (!/manifest\.firefox\.json/.test(listing) || !/AMO-BUILD\.md/.test(listing)) {
    console.error('source archive is incomplete');
    process.exit(1);
  }

  const kb = statSync(out).size / 1024;
  console.log(`${out.split('/').pop()}  ${kb.toFixed(0)} KB`);
  console.log(listing.split('\n').slice(3, 20).join('\n'));
} finally {
  rmSync(staging, { recursive: true, force: true });
}
