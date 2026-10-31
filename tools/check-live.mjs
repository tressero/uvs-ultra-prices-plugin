/** Verify the built extension against the live site (not the fixtures). */
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const EXT = resolve('dist-dev');
const DECKS = {
  lucy: 'https://uvsultra.online/deck.php?deck=hskGhGHnUaSObBpxTNVCYVMEQhDfxx',
  grog: 'https://uvsultra.online/deck.php?deck=lJFvGIfdQHmjKIcDnTTvPgZXVMwhFW',
};

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

for (const [slug, url] of Object.entries(DECKS)) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#uvsp-panel', { timeout: 20000 });
  } catch {
    console.log(slug, 'NO PANEL. pageerrors:', errors);
    await page.close();
    continue;
  }
  const summary = await page.evaluate(() => ({
    total: document.querySelector('.uvsp-total')?.textContent,
    sub: document.querySelector('.uvsp-sub')?.textContent,
    chips: document.querySelectorAll('.uvsp-chip').length,
    unpriced: document.querySelectorAll('.uvsp-chip--none').length,
  }));
  await page.screenshot({ path: `/tmp/opencode/live-${slug}.png` });
  console.log(slug, JSON.stringify(summary));
  await page.close();
}

await context.close();
