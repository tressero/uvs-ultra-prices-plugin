/**
 * Load the dev build against the local fixtures in a real Chromium, wait for the
 * injected prices, and save screenshots.
 *
 *   npm run build:dev && npm run preview
 *
 * Screenshots land in /tmp/opencode/uvsp-*.png
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';
const PORT = 8787;
const OUT = '/tmp/opencode';

const DECKS = [
  ['grog', 'released set, clean matches'],
  ['jp', 'ten sets, mixed coverage'],
  ['lucy', 'presale set, nothing priced'],
];

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not start: ${url}`);
}

const server = spawn(process.execPath, [join(ROOT, 'tools', 'serve-fixtures.mjs'), String(PORT)], {
  stdio: 'ignore',
});

await waitForServer(`http://localhost:${PORT}/topdecks.php`);
await mkdir(OUT, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 1000 },
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${join(ROOT, 'dist-dev')}`,
    `--load-extension=${join(ROOT, 'dist-dev')}`,
  ],
});

try {
  const workerHits = [];
  context.on('request', (request) => {
    if (/\/v1\/(quote|health)/.test(request.url())) workerHits.push(request.url());
  });

  for (const [slug, note] of DECKS) {
    const page = await context.newPage();
    const errors = [];
    const before = workerHits.length;
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(String(error)));

    await page.goto(`http://localhost:${PORT}/deck.php?deck=${slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#uvsp-panel', { timeout: 15000 });

    const summary = await page.evaluate(() => {
      const panel = document.querySelector('#uvsp-panel');
      const chips = [...document.querySelectorAll('.uvsp-chip')];
      return {
        total: panel.querySelector('.uvsp-total')?.textContent,
        sub: panel.querySelector('.uvsp-sub')?.textContent,
        notes: [...panel.querySelectorAll('.uvsp-panel-note')].map((n) => n.textContent),
        chips: chips.length,
        unpriced: chips.filter((c) => c.classList.contains('uvsp-chip--none')).length,
        unsure: chips.filter((c) => c.classList.contains('uvsp-chip--unsure')).length,
        firstChips: chips.slice(0, 6).map((c) => ({
          text: c.textContent,
          title: (c.title || '').slice(0, 70),
          href: c.getAttribute('href'),
        })),
      };
    });

    await page.screenshot({ path: join(OUT, `uvsp-${slug}.png`), fullPage: false });
    console.log(`\n=== ${slug} (${note}) ===`);
    console.log(`worker requests: ${workerHits.length - before}`);
    console.log(JSON.stringify(summary, null, 2));
    if (errors.length) console.log('console errors:', errors);
    await page.close();
  }
} finally {
  await context.close();
  server.kill();
}
