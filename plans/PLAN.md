# UVS Ultra Deck Prices — Chrome Extension Plan

Status: **v1.0 shipped; v1.1 plan in [`PLAN-v1.1.md`](PLAN-v1.1.md)**
Decisions locked: prices on **deck page + top decks + search/card pages**, **own proxy worker**
for pricing data, **market price** as the default headline (Mid/Low selectable), **public Chrome
Web Store** distribution.

---

## 1. Problem

UVS Ultra (`uvsultra.online`) shows decks but no prices. Users have to look up every card on
TCGplayer by hand to learn what a deck costs. The extension adds TCGplayer prices inline:
a price chip next to every card on a deck page, a deck total, and a total for each deck card
in the Top Decks list.

## 2. Verified findings (from live site + data-source probing)

These were checked directly against the live pages, not assumed.

### 2.1 UVS Ultra DOM

**Deck page** — `https://uvsultra.online/deck.php?deck=<id>`

Each card row already carries everything needed to identify the card:

```html
<li id="deck-card-12875" class="card-list card-list-character"
    onmouseover="...preview_listing_deck2('ft01', '010', 'character')...">
  <img src="images/extensions/ft01/010-ci-micro.jpg" class="ci-micro_image"/>
  Lucy Heartfilia, Celestial Wizard
  <span class="badge badge-success">x<span id="number_card_12875">1</span></span>
</li>
```

- **set code**: `ft01` (from `onmouseover` and from the `img` path)
- **collector number**: `010`
- **name**: text node after the `img`
- **quantity**: `span#number_card_<cardId>`

**Card list fragment** — `deck_card_list.php?js&deck=<id>`

Returns the same `<li>` markup as a **13 KB fragment** instead of the 72 KB full page.
This is the cheap scrape target for the Top Decks list.

**Card page** — `card.php?id=<cardId>`

Shows `Set 76 - Fairy Tail: All Fired Up! #10` plus name, type, rarity, format. One request
per card, so avoid it in bulk; use the deck list markup instead.

**Top Decks** — `https://uvsultra.online/topdecks.php`

- 60 `.deck-list-deck` cards, no pagination.
- Card structure: `.deck-list-deck-stats`, `a.deck-list-deck-image[href*="deck.php?deck="]`,
  `.deck-list-deck-info` (name link, format label, card-count label, creator).
- No card data in the markup — a total requires one fragment fetch per deck.

Note: the site's visible "Tournament Decks" / "MetaVersus Decks" nav entries point at
`folder.php?id=...`, not `topdecks.php`. The same renderer should run there too.

### 2.2 Pricing sources

| Option | Verdict |
| --- | --- |
| TCGplayer public API v1.x | **Dead** (decommissioned 2024). |
| Scraping tcgplayer.com | Client-side app; `mpapi.tcgplayer.com` endpoints probed → 404. Cloudflare. Brittle + ToS violation. |
| **tcgcsv.com** (daily TCGplayer mirror) | **Works.** Category `25 = UniVersus`, 61 groups. Products carry `Number` (`10/211`), `Rarity`, `CardType` in `extendedData`. Separate prices collection: `lowPrice`, `midPrice`, `marketPrice`, `highPrice`. |
| TCGplayer affiliate feed (Impact) | Cleanest long-term path. Needs an application + approval. Apply in parallel. |

**tcgcsv constraints** (from their docs, quoted):
- "restrictive CORS policy. Standard client-side fetch or XHR requests will fail."
- "Don't make requests to TCGCSV directly from user-facing applications."
- Requires a custom `User-Agent` header — impossible to set from a browser `fetch`.
- "Applications that make more than 10,000 requests in a 24 hour period may be banned."
- Updated once per day; check `last-updated.txt` before syncing.

→ A distributed extension fetching tcgcsv directly would violate their guidelines and risk
blocking. **Hence the proxy worker.**

### 2.3 Matching feasibility (measured)

Hand-mapped 9 of the 10 sets in the "JP" deck (`JpSBUGfvtOywBcSrfWNledZLFMYjlx`):

- **26 / 29** unique cards matched
- deck total **$384.20** market
- 3 misses: one unmapped set (`cha03gmm`), one name variant (`Scanlan's Hand`)

### 2.4 Two hard findings

**a) The example Lucy deck cannot be priced yet.**
`Lucy Heartfilia, Celestial Wizard` is `Set 76 - Fairy Tail: All Fired Up! #10`. That set is a
**presale (releases 2026-11-06)** and TCGplayer currently lists only **3 sealed products**
for it, zero singles. The Lucy deck must render "—", never `$0.00`.
Demo decks should use released sets: CR02, AOT, Godzilla, TMNT.

**b) Same collector number ≠ same card.**
In CR02, `Grog Strongjaw, Mighty Half-Giant` exists as base, `(Alternate Art)` and
`(Serial Numbered)`, **all at `7/211`**, priced **~$1 vs $620**. Matching must prefer the
base variant and treat the collector number as confirmation, not identity.

---

## 3. Architecture

```
uvsultra.online                  proxy worker (Cloudflare)            tcgcsv.com
┌────────────────┐   quote     ┌──────────────────────┐   daily cron   ┌──────────┐
│ content script │ ──────────► │ catalog + prices KV  │ ─────────────► │ 61 groups│
│ (DOM inject)   │ ◄────────── │ matching + caching   │   1x / 24h     └──────────┘
└───────┬────────┘   JSON      └──────────────────────┘
        │ chrome.runtime
┌───────▼────────┐
│ MV3 service    │  fetch deck_card_list.php (13 KB, 12 h cache)
│ worker         │  fetch worker quotes (24 h cache)
└────────────────┘
```

**Why a proxy earns its keep**

1. Absorbs tcgcsv policy risk (real User-Agent, one IP, one sync per day).
2. Matching runs server-side — a bad match is fixed for *everyone* without a new extension release.
3. Lets us swap in the official TCGplayer affiliate API later without touching the client.
4. Free tier is ample: ~1–2 MB trimmed catalog + prices.

**Extension stays dumb**: parse DOM → send `[{name, set, number, qty}]` → render prices.
All matching logic lives in the worker, versioned in this repo.

---

## 4. Matching strategy (layered)

1. **Set map** — `ft01 → groupId 24911`, `cr02 → 24191`, … Curated JSON, ~100 entries, seeded
   from the set dropdown on `index.php` cross-joined with the 61 TCG group names.
2. **Collector number** — UVS `010` → TCG `10/211`. Confirms identity, disambiguates reprints.
3. **Normalized name** — lowercase, strip punctuation/accents; **prefer the variant without a
   parenthetical suffix** (`(Alternate Art)`, `(Serial Numbered)`, `(Foil)`, …).
4. **Fuzzy fallback** — Levenshtein ≤ 2, flagged in the UI as a probable match.
5. **Overrides** — hand-fixed `{setCode, number} → productId` for known mis-matches.
6. **Unpriced** — show `n/a`, exclude from the total, count it, and link to a TCGplayer search.

Deferred: RochesterCCG / CoolStuffInc fallback for UFS-era cards TCGplayer never carried.
Ship `n/a` first and measure real coverage from actual user decks.

---

## 5. UX

**Deck page**

Per-card price chip on each `li.card-list`, styled like the existing Bootstrap 3 badges, plus a
summary panel in `.deck-header`:

```
Market  $384.20   ·   Low  $311.05   ·   3 cards unpriced (approx. $12)   [toggle]
```

**Top Decks**

One line inside `.deck-list-deck-info`, under the card-count label: `≈ $384.20`.
60 decks means 60 fragment fetches, so it is **lazy**: `IntersectionObserver` + queue
(concurrency 2) + 12 h `localStorage` cache per deck id. A passive visit costs ~zero requests.

**Popup / settings**

Price metric (market / low), auto-price top decks on/off, show unmatched only (debug),
clear cache. No account, no analytics, no data collection.

Unpriced / unmatched rows get a dashed outline so a total is never silently wrong.

---

## 6. Repository layout

```
plans/PLAN.md
extension/
  manifest.json
  content/deck.js
  content/topdecks.js
  content/content.css
  background/sw.js
  popup/            popup.html, popup.js, popup.css
  shared/parse.js   parser shared by both pages and the tests
  icons/            16 / 32 / 48 / 128
worker/
  src/index.js      routes: /v1/quote, /v1/groups, /v1/health
  src/sync.js       tcgcsv -> trimmed KV catalog
  src/match.js      matching pipeline
  data/set-map.json
  data/overrides.json
  wrangler.toml
test/
  unit/             parser, matcher, totals
  e2e/              playwright + --load-extension
  contract/         nightly live-site selector check
fixtures/           saved deck pages, deck_card_list fragments, tcgcsv payloads
```

**Manifest sketch**

```jsonc
{
  "manifest_version": 3,
  "name": "UVS Ultra Deck Prices",
  "version": "0.1.0",
  "permissions": ["storage"],
  "host_permissions": ["https://uvsultra.online/*", "https://<worker>.workers.dev/*"],
  "background": { "service_worker": "sw.js", "type": "module" },
  "content_scripts": [{
    "matches": ["https://uvsultra.online/deck.php*",
                "https://uvsultra.online/topdecks.php*",
                "https://uvsultra.online/folder.php*"],
    "js": ["content.js"], "css": ["content.css"], "run_at": "document_idle"
  }],
  "action": { "default_popup": "popup.html" }
}
```

---

## 7. Worker design

- **Sync (cron, daily)**: check modified timestamp → pull the 61 UniVersus groups → store a
  trimmed catalog (drop the `Description` blobs, which are most of the ~160 KB/group) plus a
  prices map → write to KV.
- **`GET /v1/quote?cards=<compact>`** → matched prices + totals. Pure data, **never JS**
  (Chrome Web Store requirement).
- **CORS** allowlist for the extension origin; `Cache-Control` so repeat deck views are free.
- `data/set-map.json` and `data/overrides.json` deploy with the worker, so match fixes ship
  without an extension release.

---

## 8. Testing

- **Fixtures first.** Save HTML for: the Lucy deck (presale → must render "—"),
  the JP deck (10 sets, mixed coverage), one CR02 deck (clean hit). Tests never touch the
  live site.
- **Unit (vitest)**: parser (name / qty / set / number, including the doubled `<ul>` quirk),
  matcher (base vs serial variant, number mapping, fuzzy), totals with unpriced cards.
- **E2E (Playwright)**: load fixture HTML with `--load-extension`, assert chips and totals;
  assert the presale deck degrades to "—" and not `$0.00`.
- **Mock worker**: local server replaying recorded tcgcsv payloads — offline, deterministic.
- **Contract test (nightly)**: re-run the parser against live UVS Ultra, fail on selector drift.
  This is the thing that will actually break in six months, so it comes before features.

---

## 9. Milestones

| Phase | Scope | Est. |
| --- | --- | --- |
| **M0** ✅ | Repo + MV3 skeleton, deck-page parser, hardcoded price table, chips + total render | 1 d |
| **M1** ✅ | Worker + daily tcgcsv sync, matcher, set map (~100 sets), quote endpoint | 2–3 d |
| **M2** ✅ | Top Decks lazy totals, caching layers, unpriced UX | 1–2 d |
| **M3** | Settings popup, overrides, contract tests, icons, polish | 1–2 d |
| **M4** ✅ | CWS listing, privacy policy, CI packaging, optional affiliate-API migration | 1–2 d |

**Run in parallel from day one**: TCGplayer affiliate/Impact application; the nightly contract
test (before there is anything to break).

### M4 notes (built)

- `docs/store-listing.md` holds every field the dashboard asks for: name, short
  and long description, category, single-purpose statement, permission
  justifications, data-usage answers, reviewer notes.
- `/` and `/privacy` are served by the worker as static HTML with a strict CSP, so
  the store has a real privacy URL and homepage without extra hosting.
- `npm run package` produces `dist.zip` with the manifest at the root and refuses
  to run on a placeholder worker URL or a version mismatch.
- Icons are rendered from HTML in Chromium (`npm run icons`) rather than plotted
  as bitmaps, so they stay crisp at 16px.
- CI builds, tests, packages, attaches the zip to a tag release, and can upload to
  the store or deploy the worker when the secrets are present.
- Still manual, by nature: the $5 developer registration, filling the dashboard,
  and pressing "submit for review".

### M2 notes (built)

- List totals render on `topdecks.php`, `folder.php` and `user.php`, which all
  share the `.deck-list-deck` template. `topdecks.php` repeats decks across
  sections (60 cards, 32 unique decks), so rows are deduped by deck id.
- Nothing is priced until a card is within 300px of the viewport, two decks are
  in flight at a time, and each result is cached per deck for 12 hours.
- `topdecks.php` is no longer linked from the site nav; `folder.php` and
  `user.php` are where decks actually live.
- The set map was rebuilt from the site's own set dropdown (107 sets, 50 card
  names each) and now maps 60 codes to 47 TCGplayer groups. Matches need either
  half the set's names or a clear margin plus agreeing set numbers, so
  "SoulCalibur 3" is not filed under "SoulCalibur VI".
- Cloudflare's free plan allows 50 subrequests per invocation and a set costs
  two, so a full refresh is batched: 20 sets per run, three cron runs a day.
- The offline snapshot moved out of the service worker into `catalog.json`,
  loaded only when the worker is unreachable (bundle went from 2.4 MB to 6 KB).

### M1 notes (built)

- Sync is scoped to the groups `data/set-map.json` points at (12 today), not all 61
  UniVersus groups. Widening it is a one-line change in `worker/src/sync.js`.
- `compatibility_date` is `2026-05-03`: Wrangler 4.86 (newest that runs on Node 20) ships
  an older workerd. Bump both together.
- The extension still bundles the snapshot as an offline fallback, so it works before the
  worker is reachable. The worker wins whenever it has data.
- Local end-to-end check: `wrangler dev` + `WORKER_URL=http://localhost:8789 npm run build:dev`
  + `npm run preview` — one quote request per deck, totals identical to the snapshot.

---

## 10. Distribution checklist

- One-time **$5** Chrome Web Store developer registration.
- Single-purpose description: "shows TCGplayer market prices on UVS Ultra deck pages".
- Justify both host permissions: `uvsultra.online` = read the deck the user is viewing;
  worker = price data.
- Privacy policy page, even for "no personal data collected" — deck contents go only to our
  own pricing service to compute prices.
- No remote code: the worker serves JSON only.
- Icons 16/32/48/128, 3 screenshots, promo tile.
- esbuild → `dist.zip` on tag; `chrome-webstore-upload-cli` with a service-account secret in CI.

---

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| tcgcsv policy / throttling | Proxy worker: single IP, daily sync, real User-Agent, KV cache. |
| Selector drift on UVS Ultra | Saved fixtures + nightly contract test against the live site. |
| Variant mispricing (the $1 vs $620 Grog case) | Base-variant preference, collector-number confirmation, overrides, "probable match" flag. |
| Coverage gaps (presale, JP-only, UFS-era) | Honest `n/a` with a count, never `$0.00`; revisit fallback source later. |
| TCGplayer ToS | Affiliate API is the only fully clean path — apply in parallel. |

---

## 12. Accounts needed to start M0

None. M0 runs against saved fixtures and a hardcoded price table.
M1 needs a free Cloudflare account; M4 needs the $5 CWS developer registration.
