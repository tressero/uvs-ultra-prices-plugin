# UVS Ultra Deck Prices

A Chrome extension (Manifest V3) that shows TCGplayer prices next to every card
on a [UVS Ultra](https://uvsultra.online) deck page and totals the deck.

Full design and roadmap: [`plans/PLAN.md`](plans/PLAN.md).

## Status

**M4 — ready to submit to the Chrome Web Store.**

- Deck pages: a price chip per card and a deck total.
- List pages (`topdecks.php`, `folder.php`, `user.php`): a total beside each
  deck card, priced only when the card scrolls near the viewport, cached per
  deck for 12 hours.
- 60 of 105 sets map to a TCGplayer group; everything else shows `n/a` instead
  of a guessed price.

Store assets, listing copy and the submission checklist live in
[`docs/store-listing.md`](docs/store-listing.md); the policy is
[`docs/privacy.md`](docs/privacy.md) and is also served at
<https://uvs-ultra-prices.marc-ee2.workers.dev/privacy>.

## Quick start

```bash
npm install
npm run build:dev        # -> dist-dev/
npm run preview          # loads it in Chromium against local fixtures
```

`npm run preview` starts a local server over the saved fixtures, loads the
extension with Playwright, and writes screenshots to `/tmp/opencode/uvsp-*.png`.
With `WORKER_URL=http://localhost:8789` it will exercise the real worker path
(see below).

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
                    (cache → pricing worker → snapshot)
                                     │
                                     ▼
                    chips + summary panel (content/deck.js)

pricing worker ── daily cron ──► tcgcsv ──► KV (12 groups)
       ▲
       └── POST /v1/quote  { cards, metric }
```

- `extension/src/shared/parse.js` — reads set code, collector number, name and
  quantity out of each `li[id^="deck-card-"]`. All of it is already in the
  markup, so no extra request per card.
- `shared/match.js` — resolves a card to a TCGplayer product: set map → name
  (variant suffixes stripped) → collector number → fuzzy. Base printings win
  over `(Alternate Art)` / `(Serial Numbered)`. Shared by the worker and the
  extension's offline fallback, so both always agree.
- `extension/src/background/sw.js` — owns the price source: 12 h quote cache,
  then the worker, then a stale cache, then the bundled snapshot.
- `worker/src/sync.js` — pulls tcgcsv once a day into KV, trimmed to
  `{id, name, number, market, low, url}` per product.
- `extension/src/content/deck.js` — renders deck pages, and never invents a number.
- `extension/src/content/list.js` — prices deck cards on list pages lazily, two
  at a time, deduped by deck id (topdecks.php repeats the same decks across
  sections), with a 12 h cache per deck.
- `tools/build-set-map.mjs` — maps every UVS set code to a TCGplayer group by
  scoring card-name overlap, and refuses ambiguous or weak matches.

## Deploying the pricing worker

One-time setup (needs the Cloudflare account that will own the worker):

```bash
npx wrangler login                                   # browser OAuth, once
npm run worker:kv                                    # prints a namespace id
# paste that id into worker/wrangler.jsonc (id and preview_id), then:
npx wrangler secret put ADMIN_TOKEN --config worker/wrangler.jsonc
npm run worker:deploy
```

After the first deploy, prime the catalog (otherwise the first extension visit
waits for the daily cron):

```bash
npm run worker:prime
```

One invocation can only refresh ~20 sets: Cloudflare's free plan allows 50
subrequests per request, and each set costs two. `worker:prime` repeats until
the catalog is complete, which is also why the cron runs three times a day.

Then point the extension at it — one file, two consequences (the default URL in
the service worker and the manifest host permission):

```bash
# config/worker.json -> { "url": "https://uvs-ultra-prices.<your-subdomain>.workers.dev" }
npm run build
```

Local development of the worker needs no account:

```bash
npm run worker:dev                                   # http://localhost:8789
curl -X POST localhost:8789/v1/admin/sync -H "Authorization: Bearer dev-token"
WORKER_URL=http://localhost:8789 npm run build:dev
npm run preview
```

`worker/.dev.vars` (git-ignored) holds `ADMIN_TOKEN=dev-token` for local runs.

## Shipping a build

```bash
npm test            # 52 tests, no network
npm run build       # dist/
npm run package     # dist.zip, manifest at the root, version from package.json
```

`npm run package` refuses to build if `config/worker.json` still holds the
placeholder URL or if the manifest version disagrees with `package.json`.

`npm run screenshots` regenerates the three store images (1280×800) from the live
site using the built extension.

## Data

| File | What it is |
| --- | --- |
| `data/set-map.json` | UVS set code → TCGplayer group, scored by card-name overlap (`npm run set-map`) |
| `data/prices.snapshot.json` | Offline fallback, trimmed products + prices for the mapped sets (`npm run prices`) |
| `config/worker.json` | The deployed pricing worker URL (single source for the manifest and the client) |
| `fixtures/` | Saved pages so tests never touch the network (`npm run fixtures`) |
| `store/screenshots/` | Chrome Web Store screenshots (`npm run screenshots`) |

Regenerate the data when TCGplayer adds sets:

```bash
npm run fixtures && npm run set-map && npm run prices
npm test
```

`npm test` covers the parser, matcher, totals, the worker's routes and the
sync (41 tests, no network). `npm run coverage` prints per-deck coverage and
every unpriced card with its reason — the fastest way to spot a matcher
regression.

## Known limits

- **Presale sets have no singles on TCGplayer.** The Fairy Tail deck renders
  `n/a` for most rows; that is correct, not a bug.
- Sets TCGplayer does not carry (some UFS-era and JP-only printings) have no
  mapping and show `n/a`.
- The worker syncs only the groups `data/set-map.json` points at (47 today).
  Adding sets means rerunning `npm run set-map`, then `npm run prices` and
  `npm run worker:prime`.
- 45 sets are deliberately unmapped: TCGplayer has no singles for them, or the
  name overlap was too weak to trust. They show `n/a`.
- `compatibility_date` is pinned to `2026-05-03`, the newest the installed
  Wrangler's runtime supports on Node 20. Raise it together with Wrangler.
