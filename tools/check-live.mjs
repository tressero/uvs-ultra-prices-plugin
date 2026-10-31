/**
 * Verify the built extension against the live site (not the fixtures).
 *
 *   npm run build:dev && npm run check:live
 *
 * Deck pages get chips and a total; list pages get one lazy total per deck card.
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const EXT = resolve(process.env.EXT ?? 'dist-dev'); // EXT=dist checks the shipping build
const OUT = '/tmp/opencode';

const PAGES = [
  ['lucy', 'deck', 'https://uvsultra.online/deck.php?deck=hskGhGHnUaSObBpxTNVCYVMEQhDfxx'],
  ['grog', 'deck', 'https://uvsultra.online/deck.php?deck=lJFvGIfdQHmjKIcDnTTvPgZXVMwhFW'],
  ['topdecks', 'list', 'https://uvsultra.online/topdecks.php'],
  ['folder', 'list', 'https://uvsultra.online/folder.php?id=1297'],
];

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let failures = 0;

for (const [name, kind, url] of PAGES) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  try {
    if (kind === 'deck') {
      await page.waitForSelector('#uvsp-panel', { timeout: 20000 });
      const summary = await page.evaluate(() => ({
        total: document.querySelector('.uvsp-total')?.textContent,
        sub: document.querySelector('.uvsp-sub')?.textContent,
        chips: document.querySelectorAll('.uvsp-chip').length,
        unpriced: document.querySelectorAll('.uvsp-chip--none').length,
      }));
      console.log(name, JSON.stringify(summary));
    } else {
      await page.waitForSelector('.uvsp-list-price', { timeout: 20000 });
      await page.waitForTimeout(3000); // let the visible rows settle
      const summary = await page.evaluate(() => {
        const chips = [...document.querySelectorAll('.uvsp-list-price')];
        return {
          deckCards: document.querySelectorAll('.deck-list-deck').length,
          priced: chips.length,
          pricedWithNumber: chips.filter((c) => c.textContent.trim().startsWith('$') || c.textContent.trim().startsWith('≥')).length,
          loading: chips.filter((c) => c.classList.contains('uvsp-list-price--loading')).length,
          sample: chips.slice(0, 6).map((c) => c.textContent.trim()),
        };
      });
      console.log(name, JSON.stringify(summary));
    }
  } catch (error) {
    failures++;
    console.log(name, 'FAILED:', String(error).split('\n')[0], errors);
  }

  await page.screenshot({ path: `${OUT}/live-${name}.png` });
  await page.close();
}

await context.close();
if (failures) {
  console.error(`${failures} page(s) failed`);
  process.exit(1);
}
