/**
 * Background service worker.
 *
 * Owns the price source. Content scripts send card rows and get priced items
 * back; nothing outside this file knows whether prices came from the pricing
 * worker or from the bundled snapshot.
 *
 * Order of preference:
 *   1. fresh cached quote          (12h, per deck + metric)
 *   2. the pricing worker          (live prices, synced daily)
 *   3. a stale cached quote        (network down, better than nothing, flagged)
 *   4. the bundled snapshot        (first run / worker unreachable)
 */
import { priceDeck } from '../../../shared/match.js';
import { loadBundledCatalog } from '../shared/catalog.js';
import { loadSettings } from '../shared/settings.js';

const QUOTE_TTL_MS = 12 * 60 * 60 * 1000;
const INDEX_KEY = 'quoteIndex';
const MAX_CACHED_QUOTES = 60;
/** Bump when the quote shape changes so old cached payloads are not reused. */
const QUOTE_CACHE_VERSION = 'v2';

let catalog = null;

async function getCatalog() {
  if (!catalog) catalog = await loadBundledCatalog();
  return catalog;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readCache(key) {
  const stored = await chrome.storage.local.get(key);
  return stored[key] ?? null;
}

async function writeCache(key, payload) {
  const index = (await readCache(INDEX_KEY)) ?? [];
  const entry = { key, at: Date.now() };
  const next = [entry, ...index.filter((item) => item.key !== key)];

  // Keep the store bounded so chrome.storage never becomes the problem.
  while (next.length > MAX_CACHED_QUOTES) {
    const dropped = next.pop();
    await chrome.storage.local.remove(dropped.key);
  }

  await chrome.storage.local.set({ [key]: { at: entry.at, payload }, [INDEX_KEY]: next });
}

async function snapshotQuote(cards, metric, reason) {
  const deck = await getCatalog();
  return {
    ok: true,
    ...priceDeck(cards, deck, { metric }),
    updatedAt: deck.updatedAt,
    source: 'snapshot',
    warning: reason,
  };
}

async function fetchFromWorker(url, cards, metric) {
  const response = await fetch(`${url.replace(/\/$/, '')}/v1/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cards, metric }),
  });
  if (response.status === 503) {
    return { ok: false, error: 'warming-up' };
  }
  if (!response.ok) {
    return { ok: false, error: `worker returned ${response.status}` };
  }
  const body = await response.json();
  return body?.ok ? { ...body, source: 'worker' } : { ok: false, error: body?.error ?? 'bad response' };
}

async function quote(message) {
  const cards = message.cards ?? [];
  const metric = message.metric === 'low' ? 'low' : 'market';
  const settings = await loadSettings();
  const url = (settings.workerUrl || __WORKER_URL__).trim();

  // Deck-list rows quote the same deck repeatedly; keying on the deck id means
  // the card list never has to be hashed, and a re-sort does not re-request.
  const key = message.deckId
    ? `quote:${QUOTE_CACHE_VERSION}:deck:${message.deckId}:${metric}`
    : `quote:${QUOTE_CACHE_VERSION}:${await sha256Hex(JSON.stringify({ url, metric, cards }))}`;

  const cached = await readCache(key);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) {
    return { ...cached.payload, cached: true };
  }

  if (url) {
    try {
      const result = await fetchFromWorker(url, cards, metric);
      if (result.ok) {
        await writeCache(key, result);
        return result;
      }
      if (result.error === 'warming-up') {
        // First request after a deploy: the worker is filling its catalog.
        return await snapshotQuote(cards, metric, 'warming-up');
      }
      console.warn('[uvsp] worker quote failed:', result.error);
    } catch (error) {
      console.warn('[uvsp] worker unreachable:', error);
    }
  }

  if (cached) return { ...cached.payload, cached: true, stale: true };
  return await snapshotQuote(cards, metric, url ? 'worker-unreachable' : 'no-worker-configured');
}

async function catalogInfo() {
  const settings = await loadSettings();
  const url = (settings.workerUrl || __WORKER_URL__).trim();
  const deck = await getCatalog();
  const products = Object.values(deck.groups).reduce((sum, group) => sum + group.products.length, 0);
  return {
    ok: true,
    workerUrl: url,
    products,
    sets: Object.keys(deck.groups).length,
    updatedAt: deck.updatedAt,
  };
}

async function serviceStatus() {
  const settings = await loadSettings();
  const url = (settings.workerUrl || __WORKER_URL__).trim();
  if (!url) return { ok: false, error: 'no worker configured' };
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, error: `health returned ${response.status}`, workerUrl: url };
    const body = await response.json();
    return { ok: true, workerUrl: url, ...body };
  } catch (error) {
    return { ok: false, error: String(error), workerUrl: url };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'quote') {
    quote(message).then(sendResponse, (error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === 'catalog-info') {
    catalogInfo().then(sendResponse);
    return true;
  }
  if (message?.type === 'service-status') {
    serviceStatus().then(sendResponse);
    return true;
  }
  return undefined;
});
