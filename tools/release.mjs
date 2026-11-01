/**
 * Tag a release: v<version>.<commit>.
 *
 *   npm run release -- --title "Prices everywhere and safer Mass Entry"
 *   npm run release -- --title "…" --notes docs/releases/2026-10-31.md
 *
 * Pushing the tag triggers the CI release job, which builds the Chrome and
 * Firefox packages, attaches them and the AMO source archive to the GitHub
 * release, and optionally uploads to the Chrome Web Store and AMO and deploys
 * the worker.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInfo } from './lib/version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : '';
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function git(args, options = {}) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', ...options }).trim();
}

const title = arg('--title') || process.env.TITLE || '';
if (!title) fail('set --title "what this release is"');
const notes = arg('--notes');
if (notes && !existsSync(join(ROOT, notes))) fail(`missing notes file: ${notes}`);

const { label, dirty } = buildInfo(ROOT);
if (dirty && !process.argv.includes('--allow-dirty')) {
  fail('working tree is dirty; commit first or pass --allow-dirty');
}

const tag = `v${label}`;
const existing = spawnSync('git', ['-C', ROOT, 'rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
  encoding: 'utf8',
});
if (existing.status === 0) fail(`tag ${tag} already exists`);

const message = `${label} — ${title}`;
if (notes) git(['tag', '-a', tag, '-F', notes]);
else git(['tag', '-a', tag, '-m', message]);
git(['push', 'origin', tag]);

const remote = git(['remote', 'get-url', 'origin']);
const slug =
  remote
    .replace(/\.git$/, '')
    .replace(/^.*[:/]([^/]+\/[^/]+)$/, '$1') || 'tressero/uvs-ultra-prices-plugin';

console.log(`tagged   ${tag}`);
console.log(`title    ${message}`);
console.log(`actions  https://github.com/${slug}/actions`);
console.log('CI will create the release and attach the Chrome, Firefox and AMO source archives');
