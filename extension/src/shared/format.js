/** Money and confidence formatting shared by the renderers. */

export function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Whole-dollar money for the rarity estimates and their sums. Estimates are
 * always whole values ($1, $15, $30), so ".00" is noise in a tight chip.
 */
export function moneyWhole(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function confidenceLabel(confidence) {
  switch (confidence) {
    case 'exact':
      return 'exact name match';
    case 'confirmed':
      return 'name and collector number';
    case 'name':
      return 'name only';
    case 'number':
      return 'collector number only';
    case 'fuzzy':
      return 'approximate spelling';
    default:
      return 'unverified';
  }
}

/** Compact form for tight UI: $1,234 rather than $1,234.00 for large totals. */
export function moneyCompact(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}k`;
  }
  return money(value);
}

/** ISO timestamp -> 2026-10-31. Falls back to the raw value if it is not a date. */
export function shortDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

/**
 * TCGplayer product link. The canonical URL is `/product/<id>`, so the catalog
 * does not need to store a URL per product.
 */
export function productUrl(match) {
  if (!match) return null;
  if (match.url) return match.url; // older snapshots carried the full slug
  return match.id ? `https://www.tcgplayer.com/product/${match.id}` : null;
}
