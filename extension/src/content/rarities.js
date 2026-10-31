/**
 * Rarity lookup for cards that have no TCGplayer listing.
 *
 * The deck markup does not carry rarity, so it comes from the card's page on
 * UVS Ultra — one small request per unpriced card, cached for good (rarity does
 * not change). Requests are serialised and spaced so opening a list page with
 * many unpriced decks does not hammer the site.
 */
import { parseRarityFromCardPage } from '../../../shared/rarity.js';

const CACHE_PREFIX = 'rarity:';
const GAP_MS = 120;

const queue = [];
const inflight = new Set();
let running = false;
let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pump(onResolved) {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const { cardId } = queue.shift();
      const wait = GAP_MS - (Date.now() - lastRequestAt);
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();
      try {
        const response = await fetch(`/card.php?id=${encodeURIComponent(cardId)}`, {
          credentials: 'same-origin',
        });
        if (response.ok) {
          const rarity = parseRarityFromCardPage(await response.text());
          if (rarity) {
            await chrome.storage.local.set({ [`${CACHE_PREFIX}${cardId}`]: rarity });
            onResolved(new Map([[cardId, rarity]]));
          }
        }
      } catch {
        // Leave it uncached; the next visit tries again.
      } finally {
        inflight.delete(cardId);
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Resolve rarities for the given card ids.
 *
 * @param {string[]} cardIds
 * @param {{ max?: number, onResolved?: (found: Map<string,string>) => void }} options
 * @returns {Promise<Map<string,string>>} what was already cached
 */
export async function resolveRarities(cardIds, options = {}) {
  const ids = [...new Set(cardIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const keys = ids.map((id) => `${CACHE_PREFIX}${id}`);
  const stored = await chrome.storage.local.get(keys);

  const found = new Map();
  const missing = [];
  for (const id of ids) {
    const value = stored[`${CACHE_PREFIX}${id}`];
    if (value) found.set(id, value);
    else missing.push(id);
  }

  if (!found.size && !missing.length) return found;

  const max = options.max ?? 40;
  const onResolved = options.onResolved ?? (() => {});
  if (found.size) onResolved(found);

  for (const cardId of missing.slice(0, max)) {
    if (inflight.has(cardId)) continue;
    inflight.add(cardId);
    queue.push({ cardId });
  }
  // Fire and forget: callers update the UI as answers arrive.
  pump(onResolved);

  return found;
}
