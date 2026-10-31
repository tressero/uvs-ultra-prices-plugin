/**
 * TCGplayer Mass Entry links.
 *
 * Mass Entry accepts a `c` query parameter holding one entry per card, joined
 * by `||`. An entry is either `"<qty> <name>"` or `"<qty>-<productId>"`, and
 * `productline` selects the game. The page loads the list into its form; the
 * buyer reviews it and presses Add to Cart there. (This is the mechanism deck
 * sites use for their "Buy on TCGplayer" button.)
 *
 * https://www.tcgplayer.com/massentry?c=1-12345%7C%7C4%20Some%20Card&productline=UniVersus
 */

export const MASS_ENTRY_BASE = 'https://www.tcgplayer.com/massentry';
export const TCG_PRODUCT_LINE = 'UniVersus';

/**
 * Split a deck into what TCGplayer can actually sell and what it cannot.
 *
 * "Included" means the card has a real TCGplayer price in at least one metric;
 * its matched product id goes into Mass Entry. Placeholders/estimates are never
 * sent. Cards without a price are returned so the UI can list them before the
 * user continues.
 */
export function selectForMassEntry(items) {
  const included = [];
  const excluded = [];
  for (const item of items ?? []) {
    if (item?.unit != null && item?.match?.id) included.push(item);
    else excluded.push(item);
  }
  return { included, excluded };
}

/**
 * One Mass Entry line per deck row. A matched card uses its exact TCGplayer
 * product id; an unmatched card is sent by name so this helper stays useful for
 * callers that intentionally want a best-effort list. The buy flow filters to
 * priced cards before calling it.
 */
export function massEntryLines(items) {
  const lines = [];
  for (const item of items ?? []) {
    const qty = Math.max(1, Math.trunc(Number(item?.card?.qty) || 1));
    const productId = item?.match?.id;
    if (productId) {
      lines.push(`${qty}-${productId}`);
      continue;
    }
    const name = String(item?.card?.name ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name) lines.push(`${qty} ${name}`);
  }
  return lines;
}

/**
 * @param items priced items from priceDeck
 * @param options {{ productLine?: string }}
 * @returns {string|null} null when there is nothing to send
 */
export function buildMassEntryUrl(items, options = {}) {
  const lines = massEntryLines(items);
  if (!lines.length) return null;
  const productLine = options.productLine ?? TCG_PRODUCT_LINE;
  return (
    `${MASS_ENTRY_BASE}?c=${encodeURIComponent(lines.join('||'))}` +
    `&productline=${encodeURIComponent(productLine)}`
  );
}
