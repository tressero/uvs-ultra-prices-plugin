/**
 * Estimate values for cards TCGplayer has no price for.
 *
 * A card with no listing is better represented by a rough, clearly-marked
 * number than by "n/a" — a presale deck would otherwise read as free. Every
 * estimate is labelled in the UI; none of them are presented as a quote.
 */

/** One place to change the numbers. */
export const PLACEHOLDER_VALUES = {
  common: 1,
  uncommon: 1,
  rare: 1,
  ultraRare: 15,
  secretRare: 30,
};

/**
 * @param {string|null|undefined} rarity e.g. "Ultra Rare", "Secret Rare (XR)"
 * @returns {number|null} null when there is no rarity to work from
 */
export function placeholderFor(rarity) {
  if (!rarity) return null;
  const value = String(rarity).toLowerCase().trim();
  if (!value || value === 'none') return null;

  // Treatments stack ("Ultra Rare Extra Rare"), so match the highest tier first.
  if (/\bsecret\b|\bchrome\b/.test(value)) return PLACEHOLDER_VALUES.secretRare;
  if (/\bultra\b/.test(value)) return PLACEHOLDER_VALUES.ultraRare;
  return PLACEHOLDER_VALUES.common; // common, uncommon, rare, promo, starter, fixed
}

/** True when this rarity is only approximated (used for tooltips). */
export function rarityTier(rarity) {
  const value = String(rarity ?? '').toLowerCase().trim();
  if (!value) return null;
  if (/\bsecret\b|\bchrome\b/.test(value)) return 'secretRare';
  if (/\bultra\b/.test(value)) return 'ultraRare';
  if (/\buncommon\b/.test(value)) return 'uncommon';
  if (/\bcommon\b/.test(value)) return 'common';
  if (/\brare\b/.test(value)) return 'rare';
  return 'common';
}

const CARD_TYPES = new Set([
  'character',
  'foundation',
  'attack',
  'asset',
  'action',
  'backup',
  'arena',
  'side',
  'token',
  'resource',
]);

/**
 * Read the rarity out of a UVS Ultra card page.
 *
 * The `card_division cd1` block lists, one per line:
 *   Set 76 - Fairy Tail: All Fired Up! #10
 *   Character
 *   Rare
 *   Legacy
 *
 * The rarity is the line after the card type. A vocabulary fallback keeps this
 * working if the site ever reorders those lines.
 */
export function parseRarityFromCardPage(html) {
  const block = String(html ?? '').match(/card_division\s+cd1[^>]*>([\s\S]*?)<\/div>/i);
  if (!block) return null;

  const lines = block[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length - 1; index++) {
    if (CARD_TYPES.has(lines[index].toLowerCase())) {
      const rarity = lines[index + 1];
      if (/^[A-Za-z][A-Za-z ()-]{1,24}$/.test(rarity)) return rarity;
    }
  }

  // Fallback: any line that reads like a rarity and is not a known word.
  for (const line of lines) {
    if (/^(common|uncommon|rare|ultra rare|secret rare|promo|fixed|starter exclusive)/i.test(line)) {
      return line;
    }
  }
  return null;
}
