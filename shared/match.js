/**
 * Resolve a UVS Ultra card to a TCGplayer product, then price a deck.
 *
 * Resolution order was chosen from real data:
 *
 *  1. Same set (curated set map: `cr02` -> groupId 24191).
 *  2. Name, with variant suffixes stripped. TCGplayer prices the base, the
 *     "(Alternate Art)" and the "(Serial Numbered)" printing separately and
 *     they share a collector number, so name beats number here.
 *  3. Collector number as confirmation / tie-breaker.
 *  4. Number alone (the site occasionally renames a card).
 *  5. Fuzzy name, flagged as uncertain so the UI can say so.
 *
 * The Grog Strongjaw case is why order matters: base $1, serial numbered $620,
 * both at `7/211`.
 */
import { baseName, collectorNumberInt, editDistance, namesMatch, normalizeName } from './text.js';

export const CONFIDENCE = {
  EXACT: 'exact', // name matched, exactly one candidate
  CONFIRMED: 'confirmed', // name matched and the collector number agreed
  NAME: 'name', // name matched, number did not (renames, promos)
  NUMBER: 'number', // only the collector number matched
  FUZZY: 'fuzzy', // near-miss spelling
};

export const REASON = {
  SET_NOT_MAPPED: 'set-not-mapped', // UVS set has no TCGplayer group
  GROUP_MISSING: 'group-missing', // mapped, but the group is not in the data
  NO_PRODUCT: 'no-product', // set is known, card is not in it
  NO_PRICE: 'no-price', // product exists, TCGplayer has no price for it
};

function positive(value) {
  return typeof value === 'number' && value > 0 ? value : null;
}

/** True when the product is the plain printing, not a variant of the card. */
function isBasePrinting(productName, cardName) {
  // Compare before stripping suffixes: a "(Box Topper)" has the same base name
  // as the card, but it is not the base printing.
  return normalizeName(productName) === baseName(cardName);
}

/** Cheapest by market (falling back to low) so an alt art never wins a tie. */
function cheapest(products) {
  const value = (p) => positive(p.market) ?? positive(p.low) ?? Infinity;
  return [...products].sort((a, b) => value(a) - value(b))[0];
}

/**
 * @param card {{ name: string, setCode: string|null, numberInt: number|null }}
 * @param catalog {{ setMap: object, groups: Record<string, { products: any[] }> }}
 */
export function resolveCard(card, catalog) {
  const entry = card.setCode ? catalog.setMap[card.setCode] : null;
  if (!entry || !entry.groupId) {
    return { match: null, confidence: null, reason: REASON.SET_NOT_MAPPED };
  }
  const group = catalog.groups[entry.groupId];
  if (!group || !group.products.length) {
    return { match: null, confidence: null, reason: REASON.GROUP_MISSING };
  }

  const products = group.products;
  const byName = products.filter((p) => namesMatch(card.name, p.name));

  if (byName.length === 1) {
    return { match: byName[0], confidence: CONFIDENCE.EXACT, reason: null };
  }

  if (byName.length > 1) {
    // Several printings share the name: prefer the ones whose collector number
    // agrees, then the base printing, then the cheapest.
    const withNumber = card.numberInt
      ? byName.filter((p) => collectorNumberInt(p.number) === card.numberInt)
      : [];
    const pool = withNumber.length ? withNumber : byName;
    const base = pool.filter((p) => isBasePrinting(p.name, card.name));
    return {
      match: cheapest(base.length ? base : pool),
      confidence: withNumber.length ? CONFIDENCE.CONFIRMED : CONFIDENCE.NAME,
      reason: null,
    };
  }

  if (card.numberInt) {
    const byNumber = products.filter((p) => collectorNumberInt(p.number) === card.numberInt);
    if (byNumber.length) {
      const base = byNumber.filter((p) => isBasePrinting(p.name, card.name));
      const match = cheapest(base.length ? base : byNumber);
      // A number that lands on a near-identical name is as good as an exact
      // hit; a number that lands on a different name is only a hint.
      const closeness = editDistance(normalizeName(card.name), baseName(match.name), 3);
      return {
        match,
        confidence: closeness <= 2 ? CONFIDENCE.CONFIRMED : CONFIDENCE.NUMBER,
        reason: null,
      };
    }
  }

  // Fuzzy: same set, near-identical spelling. Always flagged.
  const target = normalizeName(card.name);
  let best = null;
  let bestDistance = 3; // accepts 0..2
  for (const product of products) {
    const distance = editDistance(target, baseName(product.name), 2);
    if (distance < bestDistance) {
      best = product;
      bestDistance = distance;
    }
  }
  if (best) return { match: best, confidence: CONFIDENCE.FUZZY, reason: null };

  return { match: null, confidence: null, reason: REASON.NO_PRODUCT };
}

/**
 * Pick the number to show for a card.
 *
 * TCGplayer often has a low price but no market price (thin listings). Falling
 * back keeps the card priced instead of showing "—" next to a real listing.
 */
function unitPrice(match, metric) {
  if (!match) return { unit: null, source: null };
  const market = positive(match.market);
  const low = positive(match.low);
  if (metric === 'low') {
    if (low != null) return { unit: low, source: 'low' };
    if (market != null) return { unit: market, source: 'market' };
  } else {
    if (market != null) return { unit: market, source: 'market' };
    if (low != null) return { unit: low, source: 'low' };
  }
  return { unit: null, source: null };
}

/**
 * Price a deck.
 *
 * @param cards array of parsed cards
 * @param catalog {{ setMap, groups }}
 * @param options {{ metric?: 'market'|'low' }}
 */
export function priceDeck(cards, catalog, options = {}) {
  const metric = options.metric === 'low' ? 'low' : 'market';

  const items = cards.map((card) => {
    const { match, confidence, reason } = resolveCard(card, catalog);
    const { unit, source } = unitPrice(match, metric);
    const hasProduct = Boolean(match);
    return {
      card,
      match,
      confidence,
      reason: hasProduct && unit == null ? REASON.NO_PRICE : reason,
      unit,
      unitSource: source,
      /** Priced from the other metric because this one has no value. */
      estimated: unit != null && source !== metric,
      line: unit == null ? null : Math.round(unit * card.qty * 100) / 100,
      marketUnit: match ? positive(match.market) : null,
      lowUnit: match ? positive(match.low) : null,
    };
  });

  const other = metric === 'market' ? 'low' : 'market';
  const totals = {
    market: 0,
    low: 0,
    pricedCards: 0,
    unpricedCards: 0,
    unpricedQty: 0,
    totalCards: 0,
    estimatedCards: 0,
  };

  for (const item of items) {
    totals.totalCards += item.card.qty;
    if (item.unit == null) {
      totals.unpricedCards += 1;
      totals.unpricedQty += item.card.qty;
      continue;
    }
    // The headline must equal the sum of the chips the user can see.
    totals[metric] += item.line;
    const otherUnit = metric === 'market' ? item.lowUnit : item.marketUnit;
    totals[other] += (otherUnit ?? item.unit) * item.card.qty;
    totals.pricedCards += 1;
    if (item.estimated) totals.estimatedCards += 1;
  }

  totals.market = Math.round(totals.market * 100) / 100;
  totals.low = Math.round(totals.low * 100) / 100;
  totals.metric = metric;
  totals.complete = totals.unpricedCards === 0;
  totals.coverage = totals.pricedCards / (items.length || 1);

  return { items, totals };
}
