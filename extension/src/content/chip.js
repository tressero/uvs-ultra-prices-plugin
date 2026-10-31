/**
 * One TCGplayer price chip, shared by the deck, search-result and card-page
 * renderers so every surface explains a missing price the same way.
 *
 * A chip is either:
 *   - a real number linked to the product page,
 *   - a marked estimate ("$15 (Est.)") when the card has no listing but we
 *     know its rarity, or
 *   - "n/a" when there is nothing to stand on.
 */
import { money, moneyWhole, confidenceLabel, productUrl } from '../shared/format.js';
import { placeholderFor } from '../../../shared/rarity.js';
import { FIELD_LABEL, normalizeMetric } from '../../../shared/metrics.js';

export const CHIP_CLASS = 'uvsp-chip';

export const REASON_TEXT = {
  'set-not-mapped': 'This set has no TCGplayer singles yet (presale or not carried)',
  'group-missing': 'No TCGplayer data loaded for this set',
  'no-product': 'Not found on TCGplayer',
  'no-price': 'Listed on TCGplayer, but with no price',
};

export function tcgSearchUrl(name) {
  return `https://www.tcgplayer.com/search/universus/product?q=${encodeURIComponent(name)}`;
}

/**
 * @param item a priced item from priceDeck
 * @param metric 'mid' | 'market' | 'low'
 * @param options {{ rarity?: string|null }} rarity known from the page itself
 *        (search rows and card pages print it), used for the estimate
 */
export function chipFor(item, metric, options = {}) {
  const rarity = options.rarity ?? item.match?.rarity ?? null;
  const selected = normalizeMetric(metric);

  // Matched and priced: a real number, linked to the product page.
  if (item.unit != null) {
    const chip = document.createElement('a');
    chip.className = CHIP_CLASS;
    chip.href = productUrl(item.match);
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.textContent = money(item.unit);

    const title = [`${item.match.name} — TCGplayer`];
    title.push(`mid ${money(item.match.mid)}`, `market ${money(item.match.market)}`, `low ${money(item.match.low)}`);
    if (item.estimated) {
      title.push(`no ${selected} price, showing ${FIELD_LABEL[item.unitSource] ?? 'another price'}`);
    }
    if (item.confidence !== 'exact') title.push(`match: ${confidenceLabel(item.confidence)}`);
    chip.title = title.filter(Boolean).join(' · ');

    if (item.confidence === 'fuzzy' || item.confidence === 'number') {
      chip.classList.add('uvsp-chip--unsure');
    }
    return chip;
  }

  const link = item.match?.id ? productUrl(item.match) : null;
  const searchable = item.reason !== 'set-not-mapped';
  const value = rarity ? placeholderFor(rarity) : null;

  // No price, but we know the rarity: show an estimate, marked as one.
  if (value != null) {
    const chip = document.createElement('a');
    chip.className = `${CHIP_CLASS} uvsp-chip--est`;
    chip.textContent = `${moneyWhole(value)} (Est.)`;
    chip.href = link ?? tcgSearchUrl(item.card.name);
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.title = [
      `Estimate ${moneyWhole(value)} — no TCGplayer price`,
      `${rarity} · ${REASON_TEXT[item.reason] ?? 'not listed'}`,
      'Click to check TCGplayer',
    ].join(' · ');
    return chip;
  }

  // Matched but unpriced, or not matched at all, and no rarity known yet.
  const chip = document.createElement(link || searchable ? 'a' : 'span');
  chip.className = `${CHIP_CLASS} uvsp-chip--none`;
  chip.textContent = 'n/a';
  chip.title = link
    ? `${item.match.name} — ${REASON_TEXT[item.reason] ?? 'no price'}`
    : `${REASON_TEXT[item.reason] ?? 'No TCGplayer listing found'}`;
  if (link) {
    chip.href = link;
  } else if (searchable) {
    chip.href = tcgSearchUrl(item.card.name);
    chip.title += ' — search TCGplayer';
  }
  if (chip.tagName === 'A') {
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
  }
  return chip;
}
