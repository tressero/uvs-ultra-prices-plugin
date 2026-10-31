/**
 * TCGplayer price points exposed by the extension.
 *
 *   mid     - the middle of the current listings ("listed median")
 *   market  - a weighted average of recent completed sales
 *   low     - the cheapest active listing
 *
 * High and Direct Low are in the feed but are not useful deck totals: High is an
 * outlier and Direct Low is frequently missing. Every metric falls back to the
 * other two so a card with only one price still gets a number; the fallback is
 * tracked so the UI can say which price it used.
 */

export const METRICS = ['mid', 'market', 'low'];
export const DEFAULT_METRIC = 'market';

/** The catalog field behind each metric. */
export const METRIC_FIELD = {
  mid: 'mid',
  market: 'market',
  low: 'low',
};

/** Human label for a catalog field, used in tooltips. */
export const FIELD_LABEL = {
  mid: 'listed median',
  market: 'market price',
  low: 'lowest listing',
};

/** Short label for menus and totals. */
export const METRIC_LABEL = {
  mid: 'Mid',
  market: 'Market',
  low: 'Low',
};

const FALLBACKS = {
  mid: ['mid', 'market', 'low'],
  market: ['market', 'low', 'mid'],
  low: ['low', 'market', 'mid'],
};

export function normalizeMetric(value) {
  return METRICS.includes(value) ? value : DEFAULT_METRIC;
}

function positive(value) {
  return typeof value === 'number' && value > 0 ? value : null;
}

/**
 * @param match a resolved TCGplayer product, or null
 * @param metric 'mid' | 'market' | 'low'
 * @returns {{ unit: number|null, source: string|null }} the number to show and
 *          which catalog field it actually came from
 */
export function unitPrice(match, metric) {
  if (!match) return { unit: null, source: null };
  const name = normalizeMetric(metric);
  for (const field of FALLBACKS[name]) {
    const value = positive(match[field]);
    if (value != null) return { unit: value, source: field };
  }
  return { unit: null, source: null };
}
