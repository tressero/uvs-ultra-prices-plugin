/**
 * Render the extension icons from SVG, so every size is crisp.
 *
 *   node tools/make-icons.mjs
 *
 * The mark: a deck of two cards with a dollar sign on the front one. At 16px
 * the cards turn into a white blob, so that size falls back to a bold dollar
 * sign — same background, same weight, still recognisable in a toolbar.
 *
 * Requires Playwright's Chromium (a dev dependency). The PNGs are committed, so
 * this only needs to run when the mark changes.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'extension', 'src', 'icons');
const SIZES = [16, 32, 48, 128];

function mark(size) {
  // Small sizes get one card only; the stack needs room to read as two.
  const simple = size < 32;

  const backCard = simple
    ? ''
    : `<g transform="rotate(-14 50 50)" filter="url(#soft)">
         <rect x="24" y="20" width="42" height="60" rx="6" fill="#b9c7e8" opacity="0.92"/>
       </g>`;

  // At 16px a card silhouette is a white blob; the dollar sign alone reads.
  const frontCard = simple
    ? ''
    : `<g transform="rotate(6 50 50)" filter="url(#soft)">
         <rect x="32" y="22" width="42" height="60" rx="6" fill="url(#card)"/>
       </g>`;

  const dollar = simple
    ? `<text x="50" y="53" text-anchor="middle" dominant-baseline="central"
         font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="64"
         fill="#ffffff">$</text>`
    : `<text x="53" y="53" text-anchor="middle" dominant-baseline="central"
         font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="30"
         fill="#2f4a8a" transform="rotate(6 50 50) translate(0 1)">$</text>`;

  return `<!doctype html>
<style>html,body{margin:0;background:transparent}svg{display:block}</style>
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
    <filter id="soft" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#0a1530" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#bg)"/>
  ${backCard}
  ${frontCard}
  ${dollar}
</svg>`;
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const size of SIZES) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(mark(size));
    await page.screenshot({
      path: join(OUT, `icon-${size}.png`),
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    await page.close();
    console.log(`icon-${size}.png${size < 32 ? ' (dollar only)' : ''}`);
  }
} finally {
  await browser.close();
}
