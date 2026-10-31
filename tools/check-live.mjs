/**
 * Verify the built extension against the live site (not the fixtures).
 *
 *   npm run build:dev && npm run check:live
 *
 * Deck pages get chips and a total; list pages get one lazy total per deck card;
 * search results and a card page get their own price.
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
  ['search', 'search', 'https://uvsultra.online/index.php'],
  ['card', 'card', 'https://uvsultra.online/showcard.php?id=11619'],
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
      // Placeholders need one card page per unpriced card; wait for them to settle.
      await page
        .waitForFunction(
          () => !/checking rarity/.test(document.querySelector('#uvsp-panel')?.textContent ?? ''),
          { timeout: 15000 },
        )
        .catch(() => {});
      const summary = await page.evaluate(() => ({
        total: document.querySelector('.uvsp-total')?.textContent,
        sub: document.querySelector('.uvsp-sub')?.textContent,
        chips: document.querySelectorAll('.uvsp-chip').length,
        unpriced: document.querySelectorAll('.uvsp-chip--none').length,
      }));
      console.log(name, JSON.stringify(summary));
    } else if (kind === 'search') {
      await page.fill('#name', 'Grog');
      await page.evaluate(() => window.send_form(0, false));
      await page.waitForSelector('#content .uvsp-chip', { timeout: 20000 });
      const summary = await page.evaluate(() => ({
        results: document.querySelectorAll('#content .card').length,
        chips: [...document.querySelectorAll('#content .uvsp-chip')].map((c) => c.textContent),
      }));
      console.log(name, JSON.stringify(summary));
    } else if (kind === 'card') {
      await page.waitForSelector('.uvsp-cardprice .uvsp-chip', { timeout: 20000 });
      const summary = await page.evaluate(() => ({
        chip: document.querySelector('.uvsp-cardprice .uvsp-chip')?.textContent,
        title: document.querySelector('.uvsp-cardprice .uvsp-chip')?.title,
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
          pricedWithNumber: chips.filter((c) => /^[$≥≈]/.test(c.textContent.trim())).length,
          withPlaceholders: chips.filter((c) => c.classList.contains('uvsp-list-price--estimated')).length,
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

// The buy guard must name the cards it leaves out before TCGplayer opens.
{
  const page = await context.newPage();
  await page.goto('https://uvsultra.online/deck.php?deck=hskGhGHnUaSObBpxTNVCYVMEQhDfxx', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('#uvsp-panel', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.click('#uvsp-panel .uvsp-buy');
  try {
    await page.waitForSelector('#uvsp-buy-modal', { timeout: 5000 });
    const guard = await page.evaluate(() => ({
      title: document.querySelector('#uvsp-buy-title')?.textContent,
      listed: document.querySelectorAll('.uvsp-buy-card').length,
      summary: document.querySelector('.uvsp-buy-summary')?.textContent,
      continueButton: document.querySelector('.uvsp-buy-go')?.textContent ?? null,
    }));
    console.log('buy-guard', JSON.stringify(guard));
    await page.click('.uvsp-buy-cancel');
  } catch {
    failures++;
    console.log('buy-guard FAILED: no dialog for a deck with unpriced cards');
  }
  await page.close();
}

await context.close();
if (failures) {
  console.error(`${failures} page(s) failed`);
  process.exit(1);
}
