# Firefox Add-ons (AMO) submission

Everything the AMO developer hub asks for. Copy from here during the submission;
do not improvise in the review form.

## Listing fields

| Field | Value |
| --- | --- |
| Add-on name | UVS Ultra Deck Prices |
| Add-on ID | `uvs-ultra-prices@tressero.com` |
| Summary (≤250 chars) | See TCGplayer prices on UVS Ultra decks, search results and card pages, plus a total for every deck. |
| Category | Shopping |
| Tags | tcgplayer, card prices, deck prices, uvs ultra, universus |
| License | MIT |
| Homepage URL | https://uvs-ultra-prices.marc-ee2.workers.dev |
| Privacy policy URL | https://uvs-ultra-prices.marc-ee2.workers.dev/privacy |
| Support email | marcaochsner+uvs@gmail.com |
| Support URL | https://github.com/tressero/uvs-ultra-prices-plugin/issues |
| Minimum Firefox | 140 (Android: 142) |

The add-on ID is permanent. It is already in
`extension/src/manifest.firefox.json`; changing it later creates a new add-on.

## Description

```
UVS Ultra Deck Prices adds TCGplayer prices to uvsultra.online.

Open any deck and every card gets a price next to it, with a total for the deck at
the top. "Buy deck on TCGplayer" fills TCGplayer's Mass Entry with the priced
cards and first shows which cards TCGplayer cannot price yet, so nothing is added
silently. Search for cards and each result shows its price too; open a card and
the price is there as well. Open Top Decks, a folder, or a player's deck list and
each deck shows what it costs before you click it.

HOW IT WORKS
• Prices come from TCGplayer's public catalog, refreshed daily.
• Choose Market (recent sold prices), Mid (the middle of current listings) or Low
  (the cheapest listing). Market is the default; the popup sets it for every page,
  and a deck page can override it for that page only.
• Cards are matched by set and collector number first, then by name, and the plain
  printing is always preferred over alternate art or serial-numbered versions.
• Decks are priced only as you scroll to them, and results are cached for 12 hours,
  so browsing stays fast.

HONEST NUMBERS
• A card with no TCGplayer listing gets an estimate based on its rarity — $1 for
  common, uncommon or rare, $15 for ultra rare, $30 for secret rare — always marked
  "(Est.)" so it is never mistaken for a real price.
• A deck total that includes estimates starts with "≈" and says how much of it is
  estimated. A total with cards still unpriced starts with "≥" instead, so a floor
  is never presented as the whole picture.
• Prices are a once-a-day cached snapshot; they can differ from the live price on
  TCGplayer after you click through.
• Nothing is hidden: every card says where its number came from.

PRIVACY
No accounts, no analytics, no ads. To look up prices, the add-on sends the cards
shown on the page — name, set, collector number and quantity — to its own pricing
service. No account, identifier or browsing history is attached. Firefox displays
this as "website content" in the install prompt. Full policy:
https://uvs-ultra-prices.marc-ee2.workers.dev/privacy

NOT AFFILIATED
Not affiliated with UVS Ultra, Jasco Games, or TCGplayer. Prices are informational;
always confirm on TCGplayer before buying.
```

## Data collection declaration

Firefox requires `browser_specific_settings.gecko.data_collection_permissions`
for new add-ons. The manifest declares:

```json
"data_collection_permissions": { "required": ["websiteContent"] }
```

| AMO question | Answer | Why |
| --- | --- | --- |
| Website content | **Yes, required** | The card name, set, collector number and quantity shown on the page are sent to the pricing worker. |
| Personally identifying information | No | No account, email, name or identifier is sent. |
| Browsing activity | No | Page URLs and browsing history are not sent. |
| Website activity (clicks, scrolls) | No | Not collected. |
| Location, health, financial, authentication, communications, search terms, bookmarks | No | Not requested or collected. |
| Technical and interaction data | No | No telemetry or crash reporting. |

Do not change this to `none`: that would be inaccurate and can get the add-on
rejected. The worker's standard request logs (IP, timestamp, status) are described
in the privacy policy and are not used to build profiles.

## Permission justifications

**`storage`** — caches prices on the device for 12 hours so the same deck is not
re-requested, and remembers the user's price-metric choice.

**Host permission `https://uvsultra.online/*`** — the add-on only works on this
site. It reads the cards shown on deck, search and card pages and, for list pages
(Top Decks, folders, player pages), fetches that site's own
`deck_card_list.php` fragment for the decks being displayed. Without this
permission it cannot know which cards a deck contains.

**Host permission `https://uvs-ultra-prices.marc-ee2.workers.dev/*`** — sends the
cards being viewed to the add-on's own pricing service and receives prices. This
is the only network destination for price data.

No other permissions are requested: no tabs, scripting, cookies or web-request
interception.

## Remote code

None. The add-on ships all of its JavaScript. The pricing service returns JSON
data only; the add-on never evaluates or injects code from the network.

## Source code submission

AMO requires the source archive because the shipped files are bundled and
minified.

```bash
npm ci
npm run build-for-amo   # dist-firefox/
npm run package:firefox # dist-firefox.zip
npm run source:firefox  # uvs-ultra-prices-source-<version>.<sha>.zip
```

Upload `dist-firefox.zip` as the add-on and the source zip as the source code.
The source archive includes `AMO-BUILD.md`, `package-lock.json` and the
`build-for-amo` script that AMO's builder can run. `build-for-amo` is:

```bash
node build.mjs --firefox
```

The Firefox output contains only the SemVer version, not the git commit, so a
rebuild from the archive matches the submitted package.

## Assets

| Asset | Path | Notes |
| --- | --- | --- |
| Icon 16 / 32 / 48 / 128 | `extension/src/icons/` | `npm run icons` |
| Screenshot 1 | `store/screenshots/1-deck-prices.png` | 1280×800, deck page with chips and total |
| Screenshot 2 | `store/screenshots/2-top-decks.png` | 1280×800, totals on the Top Decks list |
| Screenshot 3 | `store/screenshots/3-tournament-decks.png` | 1280×800, totals in a folder view |
| Add-on upload | `dist-firefox.zip` | `npm run package:firefox` (manifest at the zip root) |
| Source upload | `uvs-ultra-prices-source-<label>.zip` | `npm run source:firefox` |

## Review notes (paste into "Notes for the reviewer")

```
1. Open this deck: https://uvsultra.online/deck.php?deck=lJFvGIfdQHmjKIcDnTTvPgZXVMwhFW
   A "TCGplayer market" panel appears in the header and each card row gets a
   price pill on the right.
2. Open https://uvsultra.online/topdecks.php — each deck card gains a total next
   to its card count. The first few load in about a second; the rest load as you
   scroll.
3. The toolbar popup shows the price source status and a market/low toggle.

Nothing requires an account. The pricing service is public and read-only:
GET https://uvs-ultra-prices.marc-ee2.workers.dev/v1/health returns catalog status.

The add-on sends only card names, set codes, collector numbers and quantities to
that service to look up prices. It declares websiteContent for that reason. No
accounts, identifiers, analytics or browsing history are involved.
```

## First submission order

```bash
npm test
npm run icons               # only if the mark changed
npm run screenshots         # only if the UI changed
npm run package:firefox
npm run lint:firefox
npm run source:firefox
```

Then, in the AMO developer hub:

1. Create the add-on with ID `uvs-ultra-prices@tressero.com` and license MIT.
2. Upload `dist-firefox.zip`.
3. Upload the source archive and use `AMO-BUILD.md` as the build instructions.
4. Paste the fields and description above.
5. Upload the three screenshots.
6. Submit for review.

After the listing exists, update it through the tag release process in
[`docs/releasing.md`](releasing.md).
