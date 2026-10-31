/** Crop the deck header + card list out of the preview screenshots. */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PORT = 8787;
const EXT = resolve('dist-dev');
const server = spawn(process.execPath, ['tools/serve-fixtures.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 900, height: 900 },
  deviceScaleFactor: 2,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

for (const slug of ['grog', 'lucy']) {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/deck.php?deck=${slug}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#uvsp-panel');
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => {
    const header = document.querySelector('.deck-header').getBoundingClientRect();
    const rows = [...document.querySelectorAll('li[id^="deck-card-"]')].map((el) =>
      el.getBoundingClientRect(),
    );
    // Header plus the first few rows is enough to show the treatment.
    const shown = rows.slice(0, 7);
    const bottom = shown.length ? Math.max(...shown.map((r) => r.bottom)) : header.bottom;
    return { x: 0, y: Math.max(0, header.top - 8), width: 780, height: bottom - header.top + 16 };
  });
  await page.screenshot({ path: `/tmp/opencode/uvsp-${slug}-crop.png`, clip: box });
  await page.close();
}

await context.close();
server.kill();
await writeFile('/tmp/opencode/.done', '');
