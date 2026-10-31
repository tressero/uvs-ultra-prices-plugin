# UVS Ultra Deck Prices

A Chrome extension (Manifest V3) that shows TCGplayer prices next to every card
on a [UVS Ultra](https://uvsultra.online) deck page and totals the deck.

Full design and roadmap: [`plans/PLAN.md`](plans/PLAN.md).

## Status

**M0 — deck page, pricing from a committed snapshot.** Working end to end:
every card row gets a price chip, the deck header gets a total, and cards with
no TCGplayer listing degrade to `n/a` instead of `$0.00`.

Not built yet: Top Decks totals (M2) and the pricing worker (M1). Until the
worker exists, prices come from `data/prices.snapshot.json`, generated from
tcgcsv and committed — so they are as fresh as the last `npm run prices`.

## Quick start

```bash
npm install
npm run build:dev        # -> dist-dev/
npm run preview          # loads it in Chromium against local fixtures
```

`npm run preview` starts a local server over the saved fixtures, loads the
extension with Playwright, and writes screenshots to `/tmp/opencode/uvsp-*.png`.

### Load it in your own browser

```bash
npm run build            # -> dist/
```

`chrome://extensions` → enable Developer mode → **Load unpacked** → pick `dist/`.
Then open any deck on https://uvsultra.online.

## How it works

```
deck.php DOM ──► parse.js ──► {name, setCode, number, qty}
                                     │
                                     ▼
                          background service worker
                          (sw.js → match.js + catalog)
                                     │
                                     ▼
                    chips + summary panel (content/deck.js)
```

- `extension/src/shared/parse.js` — reads set code, collector number, name and
  quantity out of each `li[id^="deck-card-"]`. All of it is already in the
  markup, so no extra request per card.
- `extension/src/shared/match.js` — resolves a card to a TCGplayer product:
  set map → name (variant suffixes stripped) → collector number → fuzzy.
  Base printings win over `(Alternate Art)` / `(Serial Numbered)`.
- `extension/src/background/sw.js` — owns the price source. Content scripts
  ask over `chrome.runtime`.
- `extension/src/content/deck.js` — renders, and never invents a number: a card
  with no price shows `n/a`, and a deck with unpriced cards says so.

## Data

| File | What it is |
| --- | --- |
| `data/set-map.json` | UVS set code → TCGplayer group, scored by card-name overlap (`npm run set-map`) |
| `data/prices.snapshot.json` | Trimmed products + prices for the mapped sets (`npm run prices`) |
| `fixtures/` | Saved pages so tests never touch the network (`npm run fixtures`) |

Regenerate the data when TCGplayer adds sets:

```bash
npm run fixtures && npm run set-map && npm run prices
npm test
```

`npm test` covers the parser, matcher and totals (25 tests, no network).
`node tools/report-coverage.mjs` prints per-deck coverage and every unpriced card
with its reason — the fastest way to spot a matcher regression.

## Known limits

- **Presale sets have no singles on TCGplayer.** The Fairy Tail deck renders
  `n/a` for most rows; that is correct, not a bug.
- Sets TCGplayer does not carry (some UFS-era and JP-only printings) have no
  mapping and show `n/a`.
- Prices are only as fresh as `data/prices.snapshot.json` until the worker
  lands.
