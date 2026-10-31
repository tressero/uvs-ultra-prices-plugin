/**
 * Capture Chrome Web Store screenshots (1280x800) from the live site.
 *
 *   npm run build && npm run screenshots
 *
 * Uses the built extension, so what you see is what a user gets.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store', 'screenshots');
const EXT = join(ROOT, 'dist');

const SHOTS = [
  ['1-deck-prices', 'https://uvsultra.online/deck.php?deck=lJFvGIfdQHmjKIcDnTTvPgZXVMwhFW'],
  ['2-top-decks', 'https://uvsultra.online/topdecks.php'],
  ['3-tournament-decks', 'https://uvsultra.online/folder.php?id=1297'],
];

await mkdir(OUT, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  for (const [name, url] of SHOTS) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.uvsp-chip, #uvsp-panel, .uvsp-list-price', { timeout: 20000 });
    // Let the lazy list quotes finish before the shot.
    await page.waitForTimeout(3500);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`store/screenshots/${name}.png`);
    await page.close();
  }
} finally {
  await context.close();
}
