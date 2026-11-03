/**
 * Ask the background service worker for prices.
 *
 * Content scripts only have plain objects to send (DOM nodes cannot cross the
 * runtime boundary), and in the dev preview there is no extension runtime at
 * all — so the same call also has an in-page snapshot fallback.
 *
 * Chrome stops an idle MV3 service worker after about thirty seconds. The next
 * message is supposed to wake it, but the very first attempt often rejects with
 * "Could not establish connection. Receiving end does not exist." or "The
 * message port closed before a response was received." One lost message used to
 * mean no prices at all, so the send is retried a few times before giving up.
 */

/** Plain object for messaging: DOM nodes cannot cross the runtime boundary. */
export function serializeCards(cards) {
  return cards.map(({ element, ...rest }) => rest);
}

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 120;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param cards parsed cards (element is stripped)
 * @param metric 'mid' | 'market' | 'low'
 * @param options {{ deckId?: string }}
 * @returns {Promise<{ok: true, [key: string]: any} | {ok: false, error: string, retryable: boolean}>}
 */
export async function requestQuote(cards, metric, options = {}) {
  const plain = serializeCards(cards);

  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    let lastError = null;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'quote',
          cards: plain,
          metric,
          deckId: options.deckId,
        });
        if (response?.ok) return response;

        // The worker answered and could not price the deck. Repeating the same
        // message will produce the same answer, so fail immediately.
        return { ok: false, error: response?.error ?? 'quote failed', retryable: false };
      } catch (error) {
        lastError = error;
        if (attempt < ATTEMPTS) await wait(RETRY_DELAY_MS * attempt);
      }
    }

    console.warn('[uvsp] background worker unreachable after retries:', lastError);
    return { ok: false, error: 'worker-unreachable', retryable: true };
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
  return { ok: false, error: 'no price source', retryable: false };
}
