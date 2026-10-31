# v1.1.0 — prices everywhere, safer Mass Entry, build identity

Status: **implemented and verified locally; awaiting release tag**

## Steps

- [x] Add TCGplayer pricing to search results and card pages
- [x] Guard the deck's Mass Entry link: list cards without a price, send only priced cards
- [x] Shorten estimates to `$1 (Est.)` and call them estimates in the UI
- [x] Add the Mid price point and a Market/Mid/Low selector (Market default)
- [x] Add the page-only price selector on deck pages
- [x] Add `VERSION.txt`, build label (`1.1.0.<sha>`), popup version link, and release tooling
- [x] Regenerate the offline snapshot with mid prices
- [x] Update tests, fixtures, preview/live checks, README and store copy
- [ ] Merge the release PR and tag `v1.1.0.<sha>`

## Decisions

- Price points exposed: **Mid** (`midPrice`, listed median), **Market**
  (`marketPrice`, recent sales), **Low** (`lowPrice`, cheapest listing).
  High and Direct Low exist in the feed but are not useful deck totals.
- Default is **Market**. The popup dropdown is the global preference; the deck
  page has a non-global, page-only selector.
- The popup says prices are a once-a-day cached snapshot and may differ from the
  live price on TCGplayer.
- Mass Entry includes only cards with a real TCGplayer price. A dialog lists the
  excluded cards and why before TCGplayer opens.
- Estimates are whole dollars and marked `(Est.)`: `$1 (Est.)`, `$15 (Est.)`,
  `$30 (Est.)`.
- `VERSION.txt` holds the SemVer core (`1.1.0`). The build label is
  `1.1.0.<7-char-sha>`, the release tag is `v1.1.0.<sha>`, and the popup links
  the label to the commit on GitHub.
- A release publishes `dist-<label>.zip` for manual install / Chrome Web Store.

## 1. Search results and card pages

Already implemented on this branch:

- `extension/src/content/cards.js` prices `index.php` search results, the
  `card.php` colorbox (from search or a deck row), and `showcard.php`.
- `extension/src/shared/cardinfo.js` reads name/set/number/rarity from the
  existing markup.
- Shared `content/chip.js` and `shared/quote.js` keep every surface consistent.

## 2. Mass Entry guard

- `shared/massentry.js`:
  - `selectForMassEntry(items)` returns `{ included, excluded }` where included
    means `item.unit != null`.
  - `buildMassEntryUrl(items)` is called only with included cards.
- `extension/src/content/buy.js`:
  - no exclusions → open Mass Entry immediately;
  - exclusions → modal listing `qty × name` and the reason, with
    **Open Mass Entry (N cards)** / Cancel;
  - zero priced cards → explain, no continue.
- Deck panel note shows `Mass Entry · 68 of 71 cards · 3 left out`.
- The old "unmatched cards are sent by name" behavior is removed for this link.

## 3. Estimates

- `extension/src/shared/format.js`: `moneyWhole()`.
- Chip text: `$1 (Est.)`; tooltip says “Estimate $1 — no TCGplayer price”.
- Deck/list text says “estimate” instead of “placeholder”.

## 4. Mid / Market / Low

- `shared/metrics.js`: metric names, labels, normalization, per-metric fallback
  (`mid → market → low`, `market → low → mid`, `low → market → mid`).
- `shared/match.js`: all three unit prices and totals; default Market.
- `worker/src/sync.js`: store `midPrice` as `mid`; bump the KV schema.
- `tools/build-mock-prices.mjs`: store `mid`; regenerate
  `data/prices.snapshot.json`.
- Worker `/v1/quote` accepts `mid`, `market`, `low`.
- Popup: dropdown (Market default), global preference, cached-vs-live note.
- Deck panel: page-only selector with the same three values; not saved.
- Chips, search/card pages and list totals follow the selected metric.

## 5. Build identity

- Root `VERSION.txt` = `1.1.0`.
- `tools/lib/version.mjs`: version parsing, git short/full SHA, label, commit URL.
- `build.mjs`: manifest version from `VERSION.txt`; bake version, label, commit
  and URL into the bundles; write `dist/version.txt`.
- Popup footer: `v1.1.0.<sha>` linked to
  `https://github.com/tressero/uvs-ultra-prices-plugin/commit/<full-sha>`.
- `tools/package.mjs`: produce `dist-<label>.zip` (and `dist.zip` for the store),
  verify `VERSION.txt`, `package.json`, manifest and `dist/version.txt` agree.
- `tools/release.mjs` / `npm run release -- --title "…"`: refuse a dirty tree,
  tag `v<version>.<sha>` and push. CI publishes the GitHub release, uploads the
  zip, optionally uploads to the Chrome Web Store and deploys the worker.
- CI artifact and release asset use `dist-<label>.zip`.

## Verification

- `npm test`
- `npm run build`
- `npm run package`
- `npm run preview` (search, card popup, deck page, buy dialog)
- `npm run check:live`
- Inspect a generated Mass Entry URL in Chromium; confirm excluded cards are
  absent and TCGplayer opens Item Options with only priced cards.
- After merge/tag: confirm the GitHub release has `dist-<label>.zip` and that
  the tag matches the commit used by the build.
