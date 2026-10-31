/** Open the popup and the worker health endpoint side by side, for a visual check. */
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const EXT = resolve('dist-dev');
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 340, height: 420 },
  deviceScaleFactor: 2,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

const workers = context.serviceWorkers();
const sw = workers[0] ?? (await context.waitForEvent('serviceworker'));
const extensionId = new URL(sw.url()).host;

const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log('popup error:', m.text());
});
await page.goto(`chrome-extension://${extensionId}/popup.html`);
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/opencode/uvsp-popup.png' });

const state = await page.evaluate(() => ({
  state: document.querySelector('#service-state')?.textContent,
  host: document.querySelector('#service-host')?.textContent,
  detail: document.querySelector('#service-detail')?.textContent,
}));
console.log('extension id:', extensionId);
console.log(JSON.stringify(state, null, 2));

await context.close();
