/**
 * Version and commit identity for builds and releases.
 *
 * `VERSION.txt` holds the SemVer core (`1.1.0`). The thing that was actually
 * built is named `1.1.0.<7-char-sha>` and tagged `v1.1.0.<sha>` — the same
 * convention as the UVS pipeline, so two builds of the same line cannot collide.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_URL = 'https://github.com/tressero/uvs-ultra-prices-plugin';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const SHA = /^[0-9a-f]{7,40}$/i;

export function readVersion(root = ROOT) {
  const file = join(root, 'VERSION.txt');
  const text = readFileSync(file, 'utf8');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (!SEMVER.test(line)) {
      throw new Error(`${file}: expected a SemVer core version like 1.1.0, got ${JSON.stringify(line)}`);
    }
    return line;
  }
  throw new Error(`${file}: no version line found`);
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function sha(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return SHA.test(text) ? text : '';
}

/**
 * @returns {{
 *   version: string, short: string, full: string, label: string,
 *   commitUrl: string|null, dirty: boolean
 * }}
 */
export function buildInfo(root = ROOT, env = process.env) {
  const version = readVersion(root);
  const configuredFull = sha(env.GIT_COMMIT_FULL) || sha(env.GITHUB_SHA) || sha(env.GIT_COMMIT);
  const full = configuredFull || sha(git(root, ['rev-parse', 'HEAD']));
  const short = (configuredFull || full).slice(0, 7) || 'local';
  const label = `${version}.${short}`;
  return {
    version,
    short,
    full,
    label,
    commitUrl: full ? `${REPO_URL}/commit/${full}` : null,
    dirty: git(root, ['status', '--porcelain']) !== '',
  };
}
