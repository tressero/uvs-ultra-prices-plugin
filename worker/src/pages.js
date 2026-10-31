/**
 * The two pages a reviewer or a curious user can land on.
 *
 * Mirrors docs/privacy.md — that file is the source when the text changes.
 */

const STYLE = `
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; max-width: 46rem; padding: 2.5rem 1.25rem 4rem;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1b1b1b; background: #fff;
  }
  @media (prefers-color-scheme: dark) { body { color: #e8e8e8; background: #17181a; } }
  h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 0.25rem; }
  h2 { font-size: 1.05rem; margin: 2rem 0 0.5rem; }
  p, li { color: inherit; opacity: 0.9; }
  .sub { opacity: 0.6; font-size: 0.9rem; margin: 0 0 1.5rem; }
  code, pre { font: 0.9em ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { padding: 0.75rem; border-radius: 8px; background: rgba(127,127,127,0.12); overflow-x: auto; }
  a { color: #2f4a8a; }
  @media (prefers-color-scheme: dark) { a { color: #8fb0ff; } }
  ul { padding-left: 1.25rem; }
  .card { border: 1px solid rgba(127,127,127,0.25); border-radius: 10px; padding: 0.9rem 1.1rem; margin: 1rem 0; }
  footer { margin-top: 3rem; font-size: 0.85rem; opacity: 0.6; }
`;

export function privacyPage() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Privacy — UVS Ultra Deck Prices</title>
<style>${STYLE}</style></head>
<body>
<h1>UVS Ultra Deck Prices — Privacy Policy</h1>
<p class="sub">Last updated: 31 October 2026</p>

<p>UVS Ultra Deck Prices is a Chrome extension that shows TCGplayer prices next to
cards on <a href="https://uvsultra.online">uvsultra.online</a>. This page explains
exactly what it sends, where, and what is kept.</p>

<h2>What the extension does with your data</h2>
<p><strong>The deck you are looking at.</strong> When you open a deck page or a deck
list, the extension reads the cards on that page (card names, set, collector number
and quantity) and sends that list to its pricing service to look up prices:</p>
<pre>https://uvs-ultra-prices.marc-ee2.workers.dev</pre>
<p>That request contains only card data — no account, no identifier, no browsing
history, no IP-based profile beyond what any web request carries.</p>
<p><strong>Local cache.</strong> Prices are cached in your browser
(<code>chrome.storage.local</code>) for 12 hours so the same deck is not
re-requested on every visit. The cache stays on your device and is cleared when you
uninstall the extension.</p>

<h2>What the extension does not do</h2>
<ul>
  <li>No accounts, sign-in, or personal information.</li>
  <li>No analytics, telemetry, crash reporting, advertising, or tracking pixels.</li>
  <li>No reading of pages other than <code>uvsultra.online</code> deck pages and deck lists.</li>
  <li>No selling, sharing, or transferring of data to third parties.</li>
  <li>No remote code: the extension downloads price data only, never scripts.</li>
</ul>

<h2>The pricing service</h2>
<div class="card">
<p>It is a Cloudflare Worker operated by the extension's author. It:</p>
<ul>
  <li>stores a copy of the public TCGplayer catalog (product names, collector numbers
      and prices) in Cloudflare KV, refreshed daily;</li>
  <li>answers price requests using that copy;</li>
  <li>keeps standard request logs (URL, status, timestamp, IP) in Cloudflare for a
      short retention period for reliability and abuse prevention. These logs are not
      used to build profiles and are not shared.</li>
</ul>
</div>

<h2>Third parties</h2>
<ul>
  <li><strong>Cloudflare</strong> hosts the pricing service and processes those requests.</li>
  <li><strong>TCGplayer</strong> is the source of the price data, mirrored through
      <a href="https://tcgcsv.com">tcgcsv.com</a>. No data about you is sent to TCGplayer.</li>
  <li><strong>UVS Ultra</strong> is unaffiliated with this extension and receives no data from it.</li>
</ul>
<p>Prices are informational. Always confirm on TCGplayer before buying.</p>

<h2>Contact</h2>
<p>Email <a href="mailto:marc@ochsner.me">marc@ochsner.me</a>.</p>

<h2>Changes</h2>
<p>If this policy changes, the date above changes with it, and the extension's store
listing points at the current version of this page.</p>

<footer><a href="/">UVS Ultra Deck Prices</a></footer>
</body></html>`;
}

export function homePage() {
  const base = 'https://uvs-ultra-prices.marc-ee2.workers.dev';
  const worker = `${base}/v1/health`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>UVS Ultra Deck Prices</title>
<style>${STYLE}</style></head>
<body>
<h1>UVS Ultra Deck Prices</h1>
<p class="sub">A Chrome extension that shows TCGplayer prices on UVS Ultra decks.</p>

<p>This service exists for one reason: to answer the extension with TCGplayer prices
without sending every user to TCGplayer's own site or to a third-party mirror. It
syncs the public catalog once a day and serves trimmed JSON.</p>

<div class="card">
<h2 style="margin-top:0">Endpoints</h2>
<ul>
  <li><code>POST /v1/quote</code> — <code>{ cards, metric }</code> → priced deck</li>
  <li><code>GET /v1/health</code> — catalog status</li>
  <li><code>GET /privacy</code> — privacy policy</li>
</ul>
<p>Live status: <a href="${worker}">${worker}</a></p>
</div>

<p>The extension itself: install it from the Chrome Web Store and open any deck on
<a href="https://uvsultra.online">uvsultra.online</a>. Prices appear next to each
card, with a total for the deck and for every deck in a list.</p>

<p>Not affiliated with UVS Ultra, Jasco Games, or TCGplayer. Prices are
informational.</p>

<footer><a href="/privacy">Privacy policy</a></footer>
</body></html>`;
}
