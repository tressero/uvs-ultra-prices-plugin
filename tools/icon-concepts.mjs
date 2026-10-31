/**
 * Render icon concepts for review (not shipped).
 *
 *   node tools/icon-concepts.mjs
 *
 * Writes /tmp/opencode/icons/<concept>-<size>.png and a comparison sheet.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = '/tmp/opencode/icons';
const SIZES = [128, 48, 32, 16];

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4d74cd"/>
      <stop offset="0.55" stop-color="#2f4a8a"/>
      <stop offset="1" stop-color="#182848"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e8edf9"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#0a1530" flood-opacity="0.45"/>
    </filter>
  </defs>`;

const concepts = {
  // A card with a dollar sign on it.
  card: `${defs}
    <rect width="100" height="100" rx="22" fill="url(#bg)"/>
    <g transform="rotate(-9 50 50)" filter="url(#soft)">
      <rect x="27" y="17" width="46" height="66" rx="6" fill="url(#card)"/>
    </g>
    <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
      font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="34"
      fill="#2f4a8a" transform="rotate(-9 50 50) translate(0 1)">$</text>`,

  // A stack of cards - "a deck" - with a price on the front one.
  stack: `${defs}
    <rect width="100" height="100" rx="22" fill="url(#bg)"/>
    <g transform="rotate(-14 50 50)" filter="url(#soft)">
      <rect x="24" y="20" width="42" height="60" rx="6" fill="#b9c7e8" opacity="0.9"/>
    </g>
    <g transform="rotate(6 50 50)" filter="url(#soft)">
      <rect x="32" y="22" width="42" height="60" rx="6" fill="url(#card)"/>
    </g>
    <text x="53" y="53" text-anchor="middle" dominant-baseline="central"
      font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="30"
      fill="#2f4a8a" transform="rotate(6 50 50) translate(0 1)">$</text>`,

  // A price tag.
  tag: `${defs}
    <rect width="100" height="100" rx="22" fill="url(#bg)"/>
    <g transform="rotate(-38 50 50)" filter="url(#soft)">
      <rect x="24" y="30" width="52" height="40" rx="9" fill="url(#card)"/>
      <circle cx="34" cy="50" r="4" fill="#2f4a8a"/>
    </g>
    <text x="55" y="51" text-anchor="middle" dominant-baseline="central"
      font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="26"
      fill="#2f4a8a" transform="rotate(-38 50 50) translate(0 1)">$</text>`,

  // The current mark: a bold dollar sign.
  bold: `${defs}
    <rect width="100" height="100" rx="22" fill="url(#bg)"/>
    <text x="50" y="53" text-anchor="middle" dominant-baseline="central"
      font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="62"
      fill="#ffffff">$</text>`,
};

const page = (name, size) => `<!doctype html>
<style>html,body{margin:0;background:transparent}svg{display:block}</style>
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${concepts[name]}</svg>`;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const name of Object.keys(concepts)) {
    for (const size of SIZES) {
      const view = await browser.newPage({
        viewport: { width: size, height: size },
        deviceScaleFactor: 1,
      });
      await view.setContent(page(name, size));
      await view.screenshot({
        path: `${OUT}/${name}-${size}.png`,
        omitBackground: true,
        clip: { x: 0, y: 0, width: size, height: size },
      });
      await view.close();
    }
    // A big preview for review.
    const view = await browser.newPage({ viewport: { width: 256, height: 256 } });
    await view.setContent(page(name, 256));
    await view.screenshot({ path: `${OUT}/${name}-256.png`, omitBackground: true });
    await view.close();
    console.log(name);
  }
} finally {
  await browser.close();
}
