/**
 * Submit the Firefox build to addons.mozilla.org.
 *
 *   AMO_JWT_ISSUER=... AMO_JWT_SECRET=... npm run sign:firefox
 *   npm run sign:firefox -- --channel unlisted
 *
 * `listed` validates and submits for public review without waiting for the
 * review queue. `unlisted` returns a signed XPI immediately, but AMO does not
 * allow the same version number on both channels — see docs/releasing.md.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInfo } from './lib/version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist-firefox');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : '';
}

const channel = arg('--channel') || process.env.AMO_CHANNEL || 'listed';
if (!['listed', 'unlisted'].includes(channel)) {
  console.error(`unknown channel ${channel}; use listed or unlisted`);
  process.exit(1);
}

const issuer = process.env.AMO_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET;
if (!issuer || !secret) {
  console.error('set AMO_JWT_ISSUER and AMO_JWT_SECRET (AMO → Developer Hub → API credentials)');
  process.exit(1);
}

if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error('dist-firefox/manifest.json is missing — run `npm run package:firefox` first.');
  process.exit(1);
}

const label = buildInfo(ROOT).label;
const source = join(ROOT, `uvs-ultra-prices-source-${label}.zip`);
if (!existsSync(source)) {
  console.error(`missing ${source.split('/').pop()} — run \`npm run source:firefox\` first.`);
  process.exit(1);
}

const approvalTimeout = arg('--approval-timeout') || String(channel === 'listed' ? 0 : 900000);
const local = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'web-ext.cmd' : 'web-ext');
const command = existsSync(local) ? local : 'web-ext';

console.log(`submitting v${buildInfo(ROOT).version} to AMO (${channel})`);
execFileSync(
  command,
  [
    'sign',
    '--source-dir',
    DIST,
    '--artifacts-dir',
    join(ROOT, 'amo-artifacts'),
    '--channel',
    channel,
    '--upload-source-code',
    source,
    '--approval-timeout',
    approvalTimeout,
  ],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, WEB_EXT_API_KEY: issuer, WEB_EXT_API_SECRET: secret },
  },
);

if (channel === 'listed') {
  console.log('submitted for AMO review; the GitHub release does not wait for it');
} else {
  console.log('signed XPI written to amo-artifacts/');
}
