/**
 * Render the extension icons with a real browser, so the glyph is crisp at
 * every size instead of a hand-plotted bitmap.
 *
 *   node tools/make-icons.mjs
 *
 * Requires Playwright's Chromium (already a dev dependency). The PNGs are
 * committed, so this only needs to run when the mark changes.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'extension', 'src', 'icons');
const SIZES = [16, 32, 48, 128];

/** Sizing is in percentages/em so one document is crisp at every size. */
function markup(size) {
  return `<!doctype html>
<style>
  html, body { margin: 0; width: ${size}px; height: ${size}px; background: transparent; }
  .icon {
    width: 100%; height: 100%;
    border-radius: 22%;
    background:
      radial-gradient(120% 120% at 20% 0%, #4a6fc4 0%, #2f4a8a 45%, #1b2c55 100%);
    box-shadow: inset 0 0 0 ${Math.max(1, size * 0.035)}px rgba(255,255,255,0.10);
    display: flex; align-items: center; justify-content: center;
    font-family: "DejaVu Sans", "Helvetica Neue", Arial, sans-serif;
    font-weight: 700;
    color: #fff;
    font-size: ${Math.round(size * 0.66)}px;
    line-height: 1;
    letter-spacing: -0.02em;
    text-shadow: 0 ${Math.max(1, size * 0.012)}px ${Math.max(1, size * 0.02)}px rgba(0,0,0,0.35);
    -webkit-font-smoothing: antialiased;
  }
  .icon span { transform: translateY(${size * -0.02}px); }
</style>
<div class="icon"><span>$</span></div>`;
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const size of SIZES) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(markup(size));
    await page.screenshot({
      path: join(OUT, `icon-${size}.png`),
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    await page.close();
    console.log(`icon-${size}.png`);
  }
} finally {
  await browser.close();
}
