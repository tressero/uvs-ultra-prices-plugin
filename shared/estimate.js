/**
 * Totals that include placeholder values for cards TCGplayer cannot price.
 *
 * The real total and the placeholder total are kept apart so the UI can show
 * both and never present an estimate as a quote.
 */
import { placeholderFor } from './rarity.js';

const round = (value) => Math.round(value * 100) / 100;

/**
 * @param items priced items from priceDeck (each has unit, card, match)
 * @param options {{
 *   rarityFor?: (item) => string|null,
 *   realTotal?: number
 * }}
 */
export function estimateTotals(items, options = {}) {
  const rarityFor = options.rarityFor ?? ((item) => item.match?.rarity ?? null);
  const realTotal = options.realTotal ?? 0;

  let estimated = 0;
  let estimatedCards = 0;
  let estimatedQty = 0;
  let unknownCards = 0;
  let unknownQty = 0;

  for (const item of items) {
    if (item.unit != null) continue;
    const value = placeholderFor(rarityFor(item));
    if (value == null) {
      unknownCards += 1;
      unknownQty += item.card.qty;
      continue;
    }
    estimated += value * item.card.qty;
    estimatedCards += 1;
    estimatedQty += item.card.qty;
  }

  return {
    realTotal: round(realTotal),
    estimated: round(estimated),
    estimatedCards,
    estimatedQty,
    unknownCards,
    unknownQty,
    combined: round(realTotal + estimated),
  };
}

/** Cards whose rarity still has to be looked up from UVS Ultra. */
export function needsRarity(items) {
  return items
    .filter((item) => item.unit == null && !item.match?.rarity && item.card.cardId)
    .map((item) => item.card.cardId);
}
