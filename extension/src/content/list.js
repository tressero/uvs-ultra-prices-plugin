/**
 * List page renderer: a total next to each deck card on topdecks.php,
 * folder.php and user pages.
 *
 * A user page can hold 800 deck cards, and each total costs one deck-card-list
 * fetch, so nothing is priced until the card is near the viewport. Results are
 * cached per deck for 12 hours, and at most two decks are in flight at once.
 *
 * Cards with no TCGplayer price get a placeholder based on rarity; decks where
 * some rarities are still unknown show "≥" instead of "≈".
 */
import { parseDeckList, DECK_CARD_SELECTOR } from '../shared/list.js';
import { parseDeckCards } from '../shared/parse.js';
import { loadSettings, onSettingsChanged } from '../shared/settings.js';
import { money, shortDate } from '../shared/format.js';
import { estimateTotals, needsRarity } from '../../../shared/estimate.js';
import { resolveRarities } from './rarities.js';

const CHIP_CLASS = 'uvsp-list-price';
const CACHE_PREFIX = 'deckprice:';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CONCURRENCY = 2;
const OBSERVE_MARGIN = '300px'; // start before the card is actually on screen
const MAX_RARITY_LOOKUPS = 25; // per page load, across all decks

const state = {
  metric: 'market',
  observer: null,
  queue: [],
  inFlight: 0,
  seen: new Set(), // deck ids already queued or rendered this page
  cards: new WeakMap(), // element -> parsed card
  rarities: new Map(), // cardId -> rarity, resolved during this page load
  rarityBudget: MAX_RARITY_LOOKUPS,
  quotes: new Map(), // deckId -> quote, kept so a late rarity can repaint
};

/* ------------------------------------------------------------------ cache */

function cacheKey(deckId, metric) {
  return `${CACHE_PREFIX}${deckId}:${metric}`;
}

async function readCache(deckId, metric) {
  try {
    const key = cacheKey(deckId, metric);
    const stored = await chrome.storage.local.get(key);
    const entry = stored[key];
    if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return null;
    return entry.value;
  } catch {
    return null;
  }
}

async function writeCache(deckId, metric, value) {
  try {
    await chrome.storage.local.set({ [cacheKey(deckId, metric)]: { at: Date.now(), value } });
  } catch {
    /* storage full or unavailable: prices still render, they just refetch */
  }
}

/* ------------------------------------------------------------------ pricing */

async function fetchQuote(deckId) {
  const response = await fetch(`/deck_card_list.php?js&deck=${encodeURIComponent(deckId)}`, {
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`deck list ${response.status}`);

  const html = await response.text();
  const document_ = new DOMParser().parseFromString(html, 'text/html');
  const cards = parseDeckCards(document_).map(({ element, ...card }) => card);
  if (!cards.length) throw new Error('empty deck');

  const quote = await chrome.runtime.sendMessage({
    type: 'quote',
    cards,
    metric: state.metric,
    deckId,
  });
  if (!quote?.ok) throw new Error(quote?.error ?? 'quote failed');
  return quote;
}

/** Summarise a quote into the numbers the chip needs. */
function summarize(quote) {
  const est = estimateTotals(quote.items, {
    rarityFor: (item) => item.match?.rarity ?? state.rarities.get(item.card.cardId) ?? null,
    realTotal: quote.totals[state.metric] ?? 0,
  });

  return {
    market: quote.totals.market,
    low: quote.totals.low,
    pricedCards: quote.totals.pricedCards,
    unpricedCards: quote.totals.unpricedCards,
    totalCards: quote.totals.totalCards,
    totalUnique: quote.items.length,
    updatedAt: quote.updatedAt ?? null,
    source: quote.source ?? null,
    estimated: est.estimated,
    unknown: est.unknownCards,
    combined: est.combined,
  };
}

/* ------------------------------------------------------------------ render */

function removeChip(card) {
  card.element.querySelector(`.${CHIP_CLASS}`)?.remove();
}

function chipFor(card, value) {
  const chip = document.createElement('span');
  chip.className = CHIP_CLASS;

  const priced = value.pricedCards > 0;
  const total = value.combined ?? (state.metric === 'low' ? value.low : value.market);

  if (!priced && !value.estimated) {
    chip.classList.add(`${CHIP_CLASS}--none`);
    chip.textContent = 'n/a';
    chip.title = 'No TCGplayer prices for this deck yet';
    return chip;
  }

  // ≈ means the total includes placeholders, ≥ means some cards are still
  // excluded, so the number is only a floor.
  const prefix = value.unknown ? '≥ ' : value.estimated ? '≈ ' : '';
  chip.textContent = `${prefix}${money(total)}`;
  if (value.unknown) chip.classList.add(`${CHIP_CLASS}--partial`);
  if (value.estimated) chip.classList.add(`${CHIP_CLASS}--estimated`);

  const parts = [`TCGplayer ${state.metric} ${money(value.combined)}`];
  if (value.estimated) parts.push(`${money(value.estimated)} of it is placeholder`);
  parts.push(`${value.pricedCards} of ${value.totalUnique} cards priced`);
  if (value.unknown) parts.push(`${value.unknown} cards still unpriced`);
  if (value.source === 'worker' && value.updatedAt) parts.push(`synced ${shortDate(value.updatedAt)}`);
  if (value.source === 'snapshot') parts.push('offline snapshot');
  chip.title = parts.join(' · ');

  return chip;
}

function mount(card, chip) {
  removeChip(card);
  const host = card.labelRow ?? card.info ?? card.element;
  host.append(chip);
}

function setLoading(card) {
  const chip = document.createElement('span');
  chip.className = `${CHIP_CLASS} ${CHIP_CLASS}--loading`;
  chip.textContent = '…';
  chip.title = 'Pricing this deck…';
  mount(card, chip);
}

/**
 * Paint a deck's chip, and keep going as rarities arrive.
 * A deck is only cached once nothing is left unresolved, so a half-known total
 * never sticks for 12 hours.
 */
function paint(card, quote) {
  state.quotes.set(card.deckId, quote);
  const value = summarize(quote);
  mount(card, chipFor(card, value));

  const missing = needsRarity(quote.items).filter((cardId) => !state.rarities.has(cardId));
  if (!missing.length) {
    writeCache(card.deckId, state.metric, value);
    return;
  }

  const budget = Math.min(missing.length, state.rarityBudget);
  if (budget <= 0) return;
  state.rarityBudget -= budget;

  resolveRarities(missing.slice(0, budget), {
    max: budget,
    onResolved: (found) => {
      let changed = false;
      for (const [cardId, rarity] of found) {
        if (!state.rarities.has(cardId)) {
          state.rarities.set(cardId, rarity);
          changed = true;
        }
      }
      if (!changed) return;
      const latest = state.quotes.get(card.deckId);
      if (!latest || !card.element.isConnected) return;
      paint(card, latest);
    },
  });
}

/* ------------------------------------------------------------------- queue */

function pump() {
  while (state.inFlight < CONCURRENCY && state.queue.length) {
    const card = state.queue.shift();
    if (!card.element.isConnected) continue;

    state.inFlight++;
    fetchQuote(card.deckId)
      .then((quote) => paint(card, quote))
      .catch(() => {
        const chip = document.createElement('span');
        chip.className = `${CHIP_CLASS} ${CHIP_CLASS}--none`;
        chip.textContent = 'n/a';
        chip.title = 'Could not price this deck';
        mount(card, chip);
      })
      .finally(() => {
        state.inFlight--;
        pump();
      });
  }
}

function enqueue(card) {
  const key = card.deckId;
  if (state.seen.has(key)) return;
  state.seen.add(key);
  setLoading(card);
  state.queue.push(card);
  pump();
}

/* ------------------------------------------------------------------- entry */

async function hydrate(card) {
  const cached = await readCache(card.deckId, state.metric);
  if (cached) {
    mount(card, chipFor(card, cached));
    return;
  }
  enqueue(card);
}

function observe(card) {
  if (state.seen.has(card.deckId)) return;
  hydrate(card);
}

function scan(root = document) {
  for (const card of parseDeckList(root)) {
    if (card.element.dataset.uvspSeen === '1') continue;
    card.element.dataset.uvspSeen = '1';
    state.cards.set(card.element, card);

    // Cards already near the viewport are priced immediately, without waiting
    // for the observer's first callback.
    const nearViewport = card.element.getBoundingClientRect().top < window.innerHeight + 300;
    if (nearViewport) hydrate(card);
    else state.observer.observe(card.element);
  }
}

/** Forget every rendered chip and start over (used when the metric changes). */
function rescan() {
  state.seen.clear();
  state.queue.length = 0;
  state.rarityBudget = MAX_RARITY_LOOKUPS;
  for (const chip of document.querySelectorAll(`.${CHIP_CLASS}`)) chip.remove();
  for (const element of document.querySelectorAll(DECK_CARD_SELECTOR)) {
    element.dataset.uvspSeen = '';
    state.observer.unobserve(element);
  }
  scan(document);
}

function start(settings) {
  state.metric = settings.metric === 'low' ? 'low' : 'market';

  state.observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        state.observer.unobserve(entry.target);
        const card = state.cards.get(entry.target);
        if (card) observe(card);
      }
    },
    { rootMargin: OBSERVE_MARGIN },
  );

  scan(document);

  // Infinite scroll and AJAX folder views append cards without a reload.
  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.(DECK_CARD_SELECTOR) || node.querySelector?.(DECK_CARD_SELECTOR)) {
          scan(document);
          return;
        }
      }
    }
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  onSettingsChanged((patch) => {
    if (!patch.metric) return;
    state.metric = patch.metric === 'low' ? 'low' : 'market';
    rescan();
  });
}

loadSettings().then(start);
