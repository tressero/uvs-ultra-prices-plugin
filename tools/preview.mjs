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
      const buy = panel.querySelector('.uvsp-buy');
      return {
        total: panel.querySelector('.uvsp-total')?.textContent,
        sub: panel.querySelector('.uvsp-sub')?.textContent,
        notes: [...panel.querySelectorAll('.uvsp-panel-note')].map((n) => n.textContent),
        buy: buy
          ? {
              text: buy.textContent,
              title: buy.title,
              note: panel.querySelector('.uvsp-buy-note')?.textContent,
            }
          : null,
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

  // Deck list pages: totals next to each deck card, priced only when visible.
  {
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/topdecks.php`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.uvsp-list-price', { timeout: 20000 });
    await page.waitForTimeout(2500);

    const list = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.uvsp-list-price')];
      return {
        deckCards: document.querySelectorAll('.deck-list-deck').length,
        priced: chips.length,
        loading: chips.filter((c) => c.classList.contains('uvsp-list-price--loading')).length,
        sample: chips.slice(0, 5).map((c) => c.textContent),
      };
    });
    await page.screenshot({ path: join(OUT, 'uvsp-topdecks.png') });
    console.log('\n=== topdecks (lazy list totals) ===');
    console.log(JSON.stringify(list, null, 2));
    await page.close();
  }
  // Buy guard: a deck with unpriced cards lists them before opening TCGplayer.
  {
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/deck.php?deck=lucy`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#uvsp-panel', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.click('#uvsp-panel .uvsp-buy');
    await page.waitForSelector('#uvsp-buy-modal', { timeout: 5000 });

    const dialog = await page.evaluate(() => ({
      title: document.querySelector('#uvsp-buy-title')?.textContent,
      intro: document.querySelector('.uvsp-buy-intro')?.textContent,
      excluded: [...document.querySelectorAll('.uvsp-buy-card')].map((el) => el.textContent),
      reasons: [...document.querySelectorAll('.uvsp-buy-reason')].map((el) => el.textContent),
      summary: document.querySelector('.uvsp-buy-summary')?.textContent,
      continueButton: document.querySelector('.uvsp-buy-go')?.textContent ?? null,
    }));
    await page.screenshot({ path: join(OUT, 'uvsp-buy-guard.png') });
    console.log('\n=== buy guard ===');
    console.log(JSON.stringify(dialog, null, 2));
    await page.click('.uvsp-buy-cancel');
    await page.close();
  }

  // Page-only metric selector: changing it does not touch the saved default.
  {
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/deck.php?deck=grog`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#uvsp-panel', { timeout: 15000 });
    await page.waitForTimeout(1000);
    const before = await page.evaluate(() => ({
      label: document.querySelector('.uvsp-label')?.textContent,
      total: document.querySelector('.uvsp-total')?.textContent,
    }));
    await page.selectOption('#uvsp-panel .uvsp-metric-select', 'mid');
    await page.waitForFunction(
      () => document.querySelector('.uvsp-label')?.textContent === 'TCGplayer Mid',
      { timeout: 10000 },
    );
    const mid = await page.evaluate(() => ({
      label: document.querySelector('.uvsp-label')?.textContent,
      total: document.querySelector('.uvsp-total')?.textContent,
      note: document.querySelector('.uvsp-metric-note')?.textContent,
    }));
    console.log('\n=== page-only metric ===');
    console.log(JSON.stringify({ before, mid }, null, 2));
    await page.screenshot({ path: join(OUT, 'uvsp-metric.png') });
    await page.close();
  }

  // Search results and the card popup, both on index.php.
  {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(String(error)));

    await page.goto(`http://localhost:${PORT}/index.php`, { waitUntil: 'domcontentloaded' });
    await page.fill('#name', 'Grog');
    await page.click('#search button[type="submit"]');
    await page.waitForSelector('#content .uvsp-chip', { timeout: 15000 });

    const search = await page.evaluate(() => ({
      results: document.querySelectorAll('#content .card').length,
      chips: [...document.querySelectorAll('#content .uvsp-chip')].map((c) => ({
        text: c.textContent,
        title: (c.title || '').slice(0, 80),
      })),
    }));
    await page.screenshot({ path: join(OUT, 'uvsp-search.png') });
    console.log('\n=== search results ===');
    console.log(JSON.stringify(search, null, 2));

    // Clicking a row opens card.php in a colorbox; the price line lands there.
    await page.click('#content .card .card_title h1');
    await page.waitForSelector('#cboxLoadedContent .uvsp-cardprice .uvsp-chip', { timeout: 15000 });
    const detail = await page.evaluate(() => {
      const chip = document.querySelector('#cboxLoadedContent .uvsp-cardprice .uvsp-chip');
      return { text: chip.textContent, title: chip.title, href: chip.getAttribute('href') };
    });
    await page.screenshot({ path: join(OUT, 'uvsp-card.png') });
    console.log('\n=== card popup ===');
    console.log(JSON.stringify(detail, null, 2));
    if (errors.length) console.log('console errors:', errors);
    await page.close();
  }
} finally {
  await context.close();
  server.kill();
}
