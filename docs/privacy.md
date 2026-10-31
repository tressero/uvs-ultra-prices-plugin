# UVS Ultra Deck Prices — Privacy Policy

Last updated: 31 October 2026

UVS Ultra Deck Prices is a Chrome extension that shows TCGplayer prices next to
cards on [uvsultra.online](https://uvsultra.online). This page explains exactly
what it sends, where, and what is kept.

## What the extension does with your data

**The cards you are looking at.** When you open a deck page, a deck list, a
search result or a card page, the extension reads the cards shown there (card
names, set, collector number and quantity) and sends that list to its pricing
service to look up prices:

```
https://uvs-ultra-prices.marc-ee2.workers.dev
```

That request contains only card data — no account, no identifier, no browsing
history, no IP-based profile beyond what any web request carries.

**Local cache.** Prices are cached in your browser (`chrome.storage.local`) for
12 hours so the same deck is not re-requested on every visit. The cache stays on
your device and is cleared when you uninstall the extension.

## What the extension does not do

- No accounts, sign-in, or personal information.
- No analytics, telemetry, crash reporting, advertising, or tracking pixels.
- No reading of pages other than `uvsultra.online` deck, deck-list, search and
  card pages.
- No selling, sharing, or transferring of data to third parties.
- No remote code: the extension downloads price data only, never scripts.
- The "Buy deck on TCGplayer" button is an ordinary link. The extension sends no
  data to TCGplayer; your browser opens TCGplayer's Mass Entry page with the card
  list in the URL only when you click it.

## The pricing service

The service is a Cloudflare Worker operated by the extension's author. It:

- stores a copy of the public TCGplayer catalog (product names, collector
  numbers and prices) in Cloudflare KV, refreshed daily;
- answers price requests using that copy;
- keeps standard request logs (URL, status, timestamp, IP) in Cloudflare for a
  short retention period for reliability and abuse prevention. These logs are
  not used to build profiles and are not shared.

## Third parties

- **Cloudflare** hosts the pricing service and processes those requests.
- **TCGplayer** is the source of the price data, mirrored through
  [tcgcsv.com](https://tcgcsv.com). No data about you is sent to TCGplayer.
- **UVS Ultra** is unaffiliated with this extension; it does not receive any
  data from it.

Prices are informational. Always confirm on TCGplayer before buying.

## Contact

Email <marcaochsner+uvs@gmail.com>.

## Source

This page is published at
<https://uvs-ultra-prices.marc-ee2.workers.dev/privacy>. The copy in the
extension's repository is identical.

## Changes

If this policy changes, the date above changes with it, and the extension's
store listing points at the current version of this page.
