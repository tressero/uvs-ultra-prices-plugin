<h1 align="center">
  <img src="extension/src/icons/icon-128.png" width="88" alt="UVS Ultra Deck Prices icon">
  <br>
  UVS Ultra Deck Prices
</h1>

<p align="center">
  <strong>TCGplayer prices on every UVS Ultra deck, search result and card page.</strong><br>
  A free browser extension for Chrome and Firefox — no account needed.
</p>

<!-- When the Firefox Add-ons listing is live, point the Firefox badge and the
     note below at the AMO listing. -->
<p align="center">
  <a href="https://chromewebstore.google.com/detail/uvs-ultra-deck-prices/oheojpdmolhnhlojoojnkgpnadnanljd"><img src="docs/badges/chrome-web-store.svg" height="56" alt="Available in the Chrome Web Store"></a>
  <a href="#install-from-a-github-release-zip"><img src="docs/badges/firefox-addons.svg" height="56" alt="Firefox Add-ons — install from a release zip while the store listing is in review"></a>
</p>

<p align="center">
  <em>Firefox Add-ons is in review — the Firefox badge goes to the zip install steps below.</em>
</p>

<p align="center">
  <img src="docs/images/readme-deck.png" width="760" alt="A UVS Ultra deck with a TCGplayer price next to every card and the deck total at the top">
</p>

## Install

### Chrome, Edge and Brave

The extension is live on the Chrome Web Store.

1. Open the **[UVS Ultra Deck Prices listing](https://chromewebstore.google.com/detail/uvs-ultra-deck-prices/oheojpdmolhnhlojoojnkgpnadnanljd)**.
2. Click **Add to Chrome**, then **Add extension**.
3. Open any deck on [uvsultra.online](https://uvsultra.online). Prices appear next
   to every card and the deck total appears at the top.

Edge may ask you to allow extensions from other stores before it will install
from the Chrome Web Store.

### Firefox

The Firefox Add-ons listing is **in review**. Until it is approved, use the
[zip install](#install-from-a-github-release-zip) below. Firefox keeps a
temporary add-on only until it restarts, so the store will be the permanent
option once it is live.

### Install from a GitHub release zip

Use this to try a new build before it reaches the stores, or if you cannot use
the stores. It takes about two minutes.

1. Open the [latest release](https://github.com/tressero/uvs-ultra-prices-plugin/releases/latest).
2. In the **Assets** list, download the file for your browser:
   - **Chrome, Edge or Brave:** `dist-<version>.<sha>.zip` (not
     `dist-firefox-...`), for example `dist-1.1.0.5211f58.zip`.
   - **Firefox:** `dist-firefox-<version>.<sha>.zip`, for example
     `dist-firefox-1.1.0.5211f58.zip`.

   Ignore the `uvs-ultra-prices-source-...zip` file; that one is for store
   reviewers. If the newest release has no `dist-firefox-` zip yet, use the
   newest release that does, or [build from source](#build-from-source).
3. Unzip the download into a folder you will keep. You should see
   `manifest.json` directly inside the folder. The browser loads the folder,
   not the zip file.

#### Chrome, Edge and Brave

1. Open `chrome://extensions` in a new tab. In Edge, use `edge://extensions`; in
   Brave, `brave://extensions`.
2. Turn on **Developer mode** — top right in Chrome, left sidebar in Edge.
3. Click **Load unpacked** and choose the unzipped folder, the one that contains
   `manifest.json`.
4. Open any deck on [uvsultra.online](https://uvsultra.online).

Chrome may show a notice about developer-mode extensions when it starts. Keep
them enabled if asked. The extension stays installed until you remove it or turn
developer mode off; some managed browsers block developer mode entirely.

#### Firefox

1. Open `about:debugging#/runtime/this-firefox` in a new tab.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` inside the unzipped folder.
4. Open any deck on [uvsultra.online](https://uvsultra.online).

Firefox removes temporary add-ons when it restarts. Load `manifest.json` again
after a restart, or install from Firefox Add-ons once the listing is approved.
The GitHub zip is unsigned, so standard Firefox will not install it permanently.

#### Updating a zip install

Download the newer release and unzip it over the same folder. In
`chrome://extensions`, click **Reload** on the extension card. In Firefox, load
`manifest.json` again from `about:debugging`.

The full walkthrough, including troubleshooting, is in
[`docs/manual-install.md`](docs/manual-install.md).

## What it does

- **Deck pages:** a TCGplayer price next to every card and a total at the top.
  **Buy deck on TCGplayer** sends only the priced cards to Mass Entry; cards
  TCGplayer cannot price are listed first so nothing is added silently.
- **Search and card pages:** prices appear in search results and on card pages,
  including the popup opened from a deck row.
- **Deck lists:** Top Decks, folders and player pages show what each deck costs
  before you open it.
- **Your price basis:** choose **Market** (recent sold prices, the default),
  **Mid** (typical current listing) or **Low** (cheapest listing) from the
  extension popup. A deck page can override it for that page only.
- **Honest estimates:** a card TCGplayer cannot price gets a rarity-based
  estimate marked `(Est.)`. A total that includes estimates starts with `≈`; a
  total with cards still unpriced starts with `≥`.

## Privacy

No account, no analytics, no ads. The only data sent anywhere is the list of
cards you are viewing, sent to this project's pricing service so it can return
prices. Everything else stays in your browser. Read the
[privacy policy](https://uvs-ultra-prices.marc-ee2.workers.dev/privacy).

UVS Ultra Deck Prices is not affiliated with UVS Ultra, Jasco Games or
TCGplayer. Prices are informational; confirm them on TCGplayer before buying.

## Development

UVS Ultra Deck Prices is a Manifest V3 extension. Build, test and release notes
for contributors — if you only want to use the extension, stop at
[Install](#install). Full design and roadmap:
[`plans/PLAN.md`](plans/PLAN.md).

### Project status

**v1.1.0** — live on the Chrome Web Store; the Firefox Add-ons submission is in
review. Store assets, listing copy and the submission checklist live in
[`docs/store-listing.md`](docs/store-listing.md) for Chrome and
[`docs/firefox-listing.md`](docs/firefox-listing.md) for Firefox; the policy is
[`docs/privacy.md`](docs/privacy.md) and is also served at
<https://uvs-ultra-prices.marc-ee2.workers.dev/privacy>. The release runbook is
[`docs/releasing.md`](docs/releasing.md) and manual installs are covered in
[`docs/manual-install.md`](docs/manual-install.md).

### Quick start

```bash
npm install
npm run build:dev          # -> dist-dev/ (Chrome)
npm run build:firefox:dev  # -> dist-firefox-dev/ (Firefox)
npm run preview            # loads the Chrome build in Chromium against local fixtures
```

`npm run preview` starts a local server over the saved fixtures, loads the
extension with Playwright, and writes screenshots to `/tmp/opencode/uvsp-*.png`.
With `WORKER_URL=http://localhost:8789` it will exercise the real worker path
(see below).

### Build from source

```bash
npm run build            # -> dist/ (Chrome)
npm run build:firefox    # -> dist-firefox/ (Firefox)
```

Then load `dist/` or `dist-firefox/` using the browser steps in
[Install from a GitHub release zip](#install-from-a-github-release-zip), choosing
the built folder instead of an extracted one.

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

pricing worker ── twice-daily cron ──► tcgcsv ──► KV (47 groups)
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
- `shared/metrics.js` — the Mid/Market/Low price points and their fallbacks
  (`mid → market → low`, and equivalents). Every total equals the chips it
  renders.
- `extension/src/background/sw.js` — owns the price source: 12 h quote cache,
  then the worker, then a stale cache, then the bundled snapshot.
- `worker/src/sync.js` — pulls tcgcsv into KV twice a day (2am and 2pm ET),
  trimmed to `{id, name, number, rarity, mid, market, low}` per product.
- `extension/src/content/deck.js` — renders deck pages, and never invents a number.
- `extension/src/content/cards.js` — prices search results (`listing_cards.php`
  loaded into `#content`) and card pages (the colorbox fragment and
  `showcard.php`); both print set, number and rarity, so one quote covers a page.
- `extension/src/content/list.js` — prices deck cards on list pages lazily, two
  at a time, deduped by deck id (topdecks.php repeats the same decks across
  sections), with a 12 h cache per deck and metric.
- `extension/src/content/buy.js` — lists unpriced cards in a dialog, then opens
  Mass Entry with only the cards that have a real price.
- `shared/massentry.js` — splits a deck into priced/unpriced cards and builds
  the TCGplayer Mass Entry URL from the priced ones: `qty-productId`, joined with
  `||` and scoped to the `UniVersus` product line. Opening it loads the list into
  TCGplayer and opens its Item Options dialog, ready for Add to Cart.
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
waits for the twice-daily cron):

```bash
npm run worker:prime
```

One invocation can only refresh ~24 sets: Cloudflare's free plan allows 50
subrequests per request, and each set costs two. `worker:prime` repeats until
the catalog is complete. The cron runs at 2am and 2pm America/New_York: the
2am run takes the first 24 sets and the 2pm run finishes the catalog. Cron
expressions are UTC only, so `worker/wrangler.jsonc` declares both DST offsets
and `worker/src/index.js` acts only when the Eastern hour is 2 or 14.

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
npm test                 # no network
npm run build            # dist/, plus dist/version.txt
npm run package          # dist-<label>.zip + dist.zip, manifest at the root

npm run build:firefox    # dist-firefox/
npm run package:firefox  # dist-firefox-<label>.zip + dist-firefox.zip
npm run lint:firefox     # web-ext lint, warnings are errors
npm run source:firefox   # source archive required by AMO
```

`npm run package` and `npm run package:firefox` refuse to build if
`config/worker.json` still holds the placeholder URL, if `VERSION.txt` and
`package.json` disagree, or if the manifest version does not match `VERSION.txt`.
They write `dist-<version>.<sha>.zip` / `dist-firefox-<version>.<sha>.zip` for
manual installs and GitHub releases, and `dist.zip` / `dist-firefox.zip` as the
stable store-upload aliases.

`npm run screenshots` regenerates the three store images (1280×800) from the live
site using the built Chrome extension. The same images are used on AMO.

### Firefox / AMO submission build

AMO requires the source archive because esbuild bundles and minifies the
extension. Build the add-on and the matching source archive from the same
checkout:

```bash
npm ci
npm run package:firefox   # dist-firefox.zip
npm run lint:firefox      # 0 errors / 0 warnings
npm run source:firefox    # uvs-ultra-prices-source-<label>.zip
```

Upload both files through <https://addons.mozilla.org/developers/>. The source
archive contains `AMO-BUILD.md`, which tells reviewers to reproduce the build
with:

```bash
npm ci
npm run build-for-amo     # node build.mjs --firefox -> dist-firefox/
```

It also contains `package-lock.json`; `data/` and `config/` are committed, so the
build uses no network. Tests, fixtures and `node_modules` are left out.

In the AMO source-code form, select **Code generators or minifiers** and
**Tools that combine multiple files into a single file**. esbuild is used for
both; there are no template engines, obfuscation or remote code.

The listing copy, permission justifications and reviewer notes are in
[`docs/firefox-listing.md`](docs/firefox-listing.md); the full release process is
in [`docs/releasing.md`](docs/releasing.md).

### Versioning and releases

`VERSION.txt` is the SemVer source of truth. Chrome builds append the current
commit, so `dist/version.txt`, the popup and the release tag name the same build.
Firefox builds keep only the SemVer version so an AMO rebuild from the submitted
source produces identical files; the archive name and tag still carry the commit:

```text
VERSION.txt                    1.1.0
Chrome build label             1.1.0.<7-char-sha>
Firefox build label / manifest 1.1.0
popup (Chrome / Firefox)       v1.1.0.<sha> / v1.1.0
git tag                        v1.1.0.<sha>
```

Tagging a release (the working tree must be clean):

```bash
npm run release -- --title "Prices everywhere and safer Mass Entry"
```

That pushes the tag; CI builds both browser packages, attaches
`dist-<label>.zip`, `dist-firefox-<label>.zip` and the AMO source archive to the
GitHub release, uploads `dist.zip` to the Chrome Web Store when its secrets are
configured, submits `dist-firefox.zip` to AMO when `AMO_PUBLISH` and the AMO
secrets are configured, and deploys the pricing worker. The full runbook is
[`docs/releasing.md`](docs/releasing.md). The Chrome popup links its version label
to the commit on GitHub.

## Estimated prices

Cards TCGplayer has no listing for would otherwise be invisible in the total — a
presale deck would read as costing $190 when most of it is unknown. They get an
estimate instead, always marked `(Est.)`:

| Rarity | Estimate |
| --- | --- |
| common, uncommon, rare | $1 |
| ultra rare | $15 |
| secret rare | $30 |

- Rarity comes from the TCGplayer product when one exists, otherwise from the
  card's page on UVS Ultra (one small request per unpriced card, cached for good).
- A total that includes estimates is prefixed `≈` and states how much of it is
  estimated; a deck with cards whose rarity is still unknown shows `≥`.
- The table lives in `shared/rarity.js` (`PLACEHOLDER_VALUES`) — one place to
  change the numbers.

## Buying a deck

**Buy deck on TCGplayer** in the deck summary opens
`tcgplayer.com/massentry` with the cards that have a real TCGplayer price. Cards
the catalog cannot price — presale, not carried, or listed without a price — are
listed in a dialog first, with their quantity and the reason, and are **not** sent.

Mass Entry opens its Item Options dialog on load; choose printings and condition,
then Add to Cart. It is a link, not an API: the extension never adds anything to a
cart by itself. The line under the button states how many cards are included and
how many were left out.

## Data

| File | What it is |
| --- | --- |
| `data/set-map.json` | UVS set code → TCGplayer group, scored by card-name overlap (`npm run set-map`) |
| `data/prices.snapshot.json` | Offline fallback, trimmed products + prices for the mapped sets (`npm run prices`) |
| `VERSION.txt` | SemVer core (`1.1.0`); Chrome build label `1.1.0.<sha>`, Firefox label `1.1.0`, tag `v1.1.0.<sha>` |
| `config/worker.json` | The deployed pricing worker URL (single source for the manifest and the client) |
| `extension/src/manifest.firefox.json` | Firefox overlay: event page, Gecko ID and data-collection declaration |
| `fixtures/` | Saved pages so tests never touch the network (`npm run fixtures`) |
| `store/screenshots/` | Chrome Web Store and AMO screenshots (`npm run screenshots`) |

Regenerate the data when TCGplayer adds sets:

```bash
npm run fixtures && npm run set-map && npm run prices
npm test
```

`npm test` covers the parser, matcher, totals, price metrics, Mass Entry links,
the worker's routes and the sync (no network). `npm run coverage` prints per-deck
coverage and every unpriced card with its reason — the fastest way to spot a
matcher regression.

## Known limits

- **Presale sets have no singles on TCGplayer.** The Fairy Tail deck renders
  `n/a` for most rows; that is correct, not a bug, and those cards are left out of
  Mass Entry.
- Prices are a once-a-day tcgcsv snapshot. Any displayed number can differ from
  the live price on TCGplayer; the popup says so.
- Sets TCGplayer does not carry (some UFS-era and JP-only printings) have no
  mapping and show `n/a`.
- The worker syncs only the groups `data/set-map.json` points at (47 today).
  Adding sets means rerunning `npm run set-map`, then `npm run prices` and
  `npm run worker:prime`.
- 45 sets are deliberately unmapped: TCGplayer has no singles for them, or the
  name overlap was too weak to trust. They show `n/a`.
- The GitHub Firefox zip is unsigned. Standard Firefox only keeps it for the
  current session (`about:debugging`); permanent installs come from AMO. AMO also
  never reuses a version number, including across listed and unlisted channels.
- `compatibility_date` is pinned to `2026-05-03`, the newest the installed
  Wrangler's runtime supports on Node 20. Raise it together with Wrangler.
