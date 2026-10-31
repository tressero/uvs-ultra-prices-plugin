/**
 * Background service worker.
 *
 * Content scripts never see the price source; they ask here. M0 answers from a
 * snapshot bundled at build time. M1 swaps `loadBundledCatalog()` for a fetch
 * against the pricing worker (and caches the response), leaving every other
 * file untouched.
 */
import { priceDeck } from '../shared/match.js';
import { loadBundledCatalog } from '../shared/catalog.js';

let catalog = null;

function getCatalog() {
  if (!catalog) catalog = loadBundledCatalog();
  return catalog;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'catalog-info') {
    const deck = getCatalog();
    const products = Object.values(deck.groups).reduce((sum, g) => sum + g.products.length, 0);
    sendResponse({ ok: true, products, sets: Object.keys(deck.groups).length, updatedAt: deck.updatedAt });
    return true;
  }

  if (message?.type !== 'quote') return undefined;

  try {
    const deck = getCatalog();
    const result = priceDeck(message.cards ?? [], deck, { metric: message.metric });
    sendResponse({ ok: true, ...result, updatedAt: deck.updatedAt });
  } catch (error) {
    console.error('[uvsp] quote failed', error);
    sendResponse({ ok: false, error: String(error) });
  }
  return true;
});
