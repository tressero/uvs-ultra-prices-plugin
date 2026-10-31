/**
 * Ask the background service worker for prices.
 *
 * Content scripts only have plain objects to send (DOM nodes cannot cross the
 * runtime boundary), and in the dev preview there is no extension runtime at
 * all — so the same call also has an in-page snapshot fallback.
 */

/** Plain object for messaging: DOM nodes cannot cross the runtime boundary. */
export function serializeCards(cards) {
  return cards.map(({ element, ...rest }) => rest);
}

/**
 * @param cards parsed cards (element is stripped)
 * @param metric 'mid' | 'market' | 'low'
 * @param options {{ deckId?: string }}
 */
export async function requestQuote(cards, metric, options = {}) {
  const plain = serializeCards(cards);

  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'quote',
        cards: plain,
        metric,
        deckId: options.deckId,
      });
      if (response?.ok) return response;
      console.warn('[uvsp] quote failed:', response?.error);
    } catch (error) {
      console.warn('[uvsp] worker unreachable:', error);
    }
  }

  // Dev/preview fallback: price in-page against the bundled snapshot.
  if (__DEV__) {
    const [{ priceDeck }, { loadBundledCatalog }] = await Promise.all([
      import('../../../shared/match.js'),
      import('./catalog.js'),
    ]);
    const catalog = await loadBundledCatalog();
    return { ok: true, ...priceDeck(plain, catalog, { metric }), updatedAt: catalog.updatedAt };
  }
  return { ok: false, error: 'no price source' };
}
