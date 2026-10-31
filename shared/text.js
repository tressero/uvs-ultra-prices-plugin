/**
 * Card-name normalization shared by the parser, the matcher and the tooling.
 *
 * TCGplayer's `cleanName` drops punctuation entirely
 * ("Grog Strongjaw, Mighty Half-Giant" -> "Grog Strongjaw Mighty Half Giant"),
 * so both sides are reduced to lowercase space-separated words.
 */

/** Variant suffixes TCGplayer appends to a printing of the same card. */
const VARIANT_SUFFIX =
  /\s*\(\s*(?:alternate art|serial numbered|foil|promo|signed|extended art|borderless|full art|stamped|prerelease|showcase)\s*\)\s*$/i;

/**
 * Remove TCGplayer variant suffixes. Must run on the raw name, before
 * punctuation is stripped, because the suffix lives inside parentheses.
 * Suffixes stack: "Grog Strongjaw (Alternate Art) (Foil)".
 */
export function stripVariants(raw) {
  let name = String(raw ?? '').trim();
  for (let i = 0; i < 4 && VARIANT_SUFFIX.test(name); i++) {
    name = name.replace(VARIANT_SUFFIX, '').trim();
  }
  return name;
}

export function normalizeName(raw) {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** The base printing's normalized name, with variant suffixes removed. */
export function baseName(raw) {
  return normalizeName(stripVariants(raw));
}

/** True when the TCGplayer name is a printing/variant of the UVS card name. */
export function namesMatch(uvsName, tcgName) {
  const a = baseName(uvsName);
  const b = baseName(tcgName);
  if (!a || !b) return false;
  return a === b || b.startsWith(a + ' ') || a.startsWith(b + ' ');
}

/** Levenshtein distance, with a cap so long mismatches bail out early. */
export function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * "010" -> 10, "7/211" -> 7. UVS Ultra prints zero-padded numbers, TCGplayer
 * prints "number/setSize", so both sides are reduced to the integer.
 * Returns null when there is no leading number.
 */
export function collectorNumberInt(value) {
  const match = String(value ?? '').match(/^0*(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}
