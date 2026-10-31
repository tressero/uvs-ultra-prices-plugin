/**
 * Prime or refresh the deployed worker's catalog.
 *
 * A run can only refresh ~20 sets (Cloudflare's free plan allows 50
 * subrequests per invocation, and each set costs two), so this repeats until
 * the worker reports nothing left.
 *
 *   node tools/prime-worker.mjs            # uses worker/.admin-token
 *   ADMIN_TOKEN=... node tools/prime-worker.mjs
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokenFile = join(ROOT, 'worker', '.admin-token');

async function token() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN.trim();
  if (!existsSync(tokenFile)) {
    throw new Error('No ADMIN_TOKEN. Set it in the environment or in worker/.admin-token');
  }
  return (await readFile(tokenFile, 'utf8')).replace(/^ADMIN_TOKEN=/, '').trim();
}

const { url } = JSON.parse(await readFile(join(ROOT, 'config', 'worker.json'), 'utf8'));
const secret = await token();
const base = url.replace(/\/$/, '');

console.log(`priming ${base}`);

for (let round = 1; round <= 10; round++) {
  const response = await fetch(`${base}/v1/admin/sync?limit=20`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: '{}',
  });

  if (!response.ok) {
    console.error(`round ${round}: HTTP ${response.status} ${await response.text()}`);
    process.exit(1);
  }

  const result = await response.json();
  const line = {
    round,
    sets: result.groups?.length ?? 0,
    products: result.products ?? 0,
    remaining: result.remaining ?? 0,
    failures: result.failures?.length ?? 0,
    skipped: Boolean(result.skipped),
  };
  console.log(JSON.stringify(line));

  if (result.skipped || result.remaining === 0) break;
}

const health = await (await fetch(`${base}/v1/health`)).json();
console.log(
  `health: ${health.products} products across ${health.sets} sets` +
    (health.missingSets?.length ? `, still missing ${health.missingSets.length}` : ''),
);
