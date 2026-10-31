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
