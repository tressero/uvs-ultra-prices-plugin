# Chrome Web Store submission

Everything the dashboard asks for, written out. Copy from here, do not improvise
during the review form.

## Basics

| Field | Value |
| --- | --- |
| Name | UVS Ultra Deck Prices |
| Short description (≤132 chars) | See TCGplayer prices on every card in a UVS Ultra deck, plus a total for the deck and for every deck in a list. |
| Category | Shopping |
| Language | English |
| Homepage URL | https://uvs-ultra-prices.marc-ee2.workers.dev |
| Privacy policy URL | https://uvs-ultra-prices.marc-ee2.workers.dev/privacy |
| Support URL | https://uvs-ultra-prices.marc-ee2.workers.dev |

## Detailed description

```
UVS Ultra Deck Prices adds TCGplayer prices to uvsultra.online.

Open any deck and every card gets a price next to it, with a total for the deck at
the top. Open Top Decks, a folder, or a player's deck list and each deck shows what
it costs before you click it.

HOW IT WORKS
• Prices come from TCGplayer's public catalog, refreshed daily.
• Cards are matched by set and collector number first, then by name, and the plain
  printing is always preferred over alternate art or serial-numbered versions.
• Decks are priced only as you scroll to them, and results are cached for 12 hours,
  so browsing stays fast.

HONEST NUMBERS
• A card with no TCGplayer listing shows "n/a" instead of a made-up price.
• A deck with unpriced cards shows "≥ $X" and says how many cards are missing, so
  the total is never presented as complete when it is not.
• Presale sets and cards TCGplayer does not carry are left unpriced.

PRIVACY
No accounts, no analytics, no ads. The deck you are viewing is sent to the
extension's pricing service to look up prices and nothing else is collected. Full
policy: https://uvs-ultra-prices.marc-ee2.workers.dev/privacy

NOT AFFILIATED
Not affiliated with UVS Ultra, Jasco Games, or TCGplayer. Prices are informational;
always confirm on TCGplayer before buying.
```

## Single purpose

> Show TCGplayer prices on UVS Ultra deck pages and deck lists.

## Permission justifications

**`storage`** — caches prices on the device for 12 hours so the same deck does not
re-request them, and remembers the user's price-metric choice (market or lowest).

**Host permission `https://uvsultra.online/*`** — the extension only works on this
site. It reads the cards of the deck the user is viewing and, for list pages (Top
Decks, folders, player pages), fetches that site's own `deck_card_list.php` fragment
for the decks being displayed so it can total them. Without the permission the
extension cannot know which cards a deck contains.

**Host permission `https://uvs-ultra-prices.marc-ee2.workers.dev/*`** — sends the
card list of the deck being viewed to the extension's own pricing service and gets
prices back. This is the only network destination.

No other permissions are requested: no tabs, no scripting, no cookies, no web
request interception.

## Data usage

| Question | Answer |
| --- | --- |
| Collects personally identifiable information | No |
| Collects health, financial, authentication, personal communications, location, web history, or user activity | No |
| Sells or transfers data to third parties | No |
| Uses or transfers data for purposes unrelated to the single purpose | No |
| Uses or transfers data to determine creditworthiness | No |

Disclosure to include in the listing: the card list of the deck being viewed is sent
to the extension's pricing service (a Cloudflare Worker) to look up prices. No
identifiers are attached.

## Remote code

None. The extension ships all of its own JavaScript. The pricing service returns
JSON data only; the extension never evaluates or injects code from the network.

## Assets

| Asset | Path | Notes |
| --- | --- | --- |
| Icon 16 / 32 / 48 / 128 | `extension/src/icons/` | `npm run icons` |
| Screenshot 1 | `store/screenshots/1-deck-prices.png` | 1280×800, deck page with chips and total |
| Screenshot 2 | `store/screenshots/2-top-decks.png` | 1280×800, totals on the Top Decks list |
| Screenshot 3 | `store/screenshots/3-tournament-decks.png` | 1280×800, totals in a folder view |
| Upload | `dist.zip` | `npm run package` (manifest at the zip root) |

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
```

## Order of operations

```bash
npm test                     # 49 tests, no network
npm run coverage             # sampling report, optional
npm run icons                # only if the mark changed
npm run screenshots          # regenerates the three store images
npm run package              # dist.zip
```

Then upload `dist.zip`, paste the fields above, and submit. First submission costs
$5 (one-time developer registration).
