/**
 * Search-result and card-page renderer.
 *
 * index.php runs its search over AJAX (listing_cards.php -> #content) and opens
 * a card in a colorbox (card.php -> #cboxLoadedContent); a deck row opens the
 * same colorbox; showcard.php renders the fragment as a full page. All of them
 * print the set, collector number and rarity, so one quote request prices a whole
 * result page and no extra request per card is needed.
 *
 * Quotes go through the background worker, which caches them; scrolling back
 * through the same search does not hit the network twice.
 */
import { parseSearchCards, parseDetailCards } from '../shared/cardinfo.js';
import { loadSettings, onSettingsChanged } from '../shared/settings.js';
import { requestQuote } from '../shared/quote.js';
import { chipFor, CHIP_CLASS } from './chip.js';
import { normalizeMetric } from '../../../shared/metrics.js';

const MARK = 'uvspPriced';
const SCAN_DELAY_MS = 120;

const state = {
  metric: 'market',
  showUnmatched: true,
  running: false,
  again: false,
  timer: 0,
};

function strip({ element, rarity, ...card }) {
  return card;
}

/* ------------------------------------------------------------------ render */

function paintRow(row, item, card) {
  const host = row.querySelector('.card-important-info') ?? row.querySelector('.card_title');
  if (!host) return;

  host.querySelector(`.${CHIP_CLASS}`)?.remove();
  const chip = chipFor(item, state.metric, { rarity: card.rarity });
  chip.classList.add('uvsp-chip--inline');
  host.append(chip);
  // The row opens the card popup; a price click must only follow the link.
  chip.addEventListener('click', (event) => event.stopPropagation());
}

function paintDetail(infos, item, card) {
  const host = infos.querySelector('.card_division.cd1') ?? infos.querySelector('.card_title');
  if (!host) return;

  const box = document.createElement('div');
  box.className = 'uvsp-cardprice';
  const label = document.createElement('span');
  label.className = 'uvsp-cardprice-label';
  label.textContent = 'TCGplayer';
  box.append(label, chipFor(item, state.metric, { rarity: card.rarity }));
  host.querySelector('.uvsp-cardprice')?.remove();
  host.append(box);
}

/* ------------------------------------------------------------------- quote */

/** Mark and return every card on the page that has not been priced yet. */
function takeUnpriced() {
  const entries = [];

  for (const card of parseSearchCards(document)) {
    if (card.element.dataset[MARK]) continue;
    card.element.dataset[MARK] = '1';
    entries.push({ kind: 'row', element: card.element, card });
  }
  for (const card of parseDetailCards(document)) {
    if (card.element.dataset[MARK]) continue;
    card.element.dataset[MARK] = '1';
    entries.push({ kind: 'detail', element: card.element, card });
  }
  return entries;
}

async function priceUnpriced() {
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;

  try {
    const entries = takeUnpriced();
    if (!entries.length) return;

    const quote = await requestQuote(entries.map((entry) => strip(entry.card)), state.metric);
    if (!quote?.ok) {
      // Allow a later DOM change to try again instead of leaving dead marks.
      for (const entry of entries) delete entry.element.dataset[MARK];
      return;
    }

    quote.items.forEach((item, index) => {
      const entry = entries[index];
      if (!entry || !entry.element.isConnected) return;
      if (item.unit == null && !state.showUnmatched) return;
      if (entry.kind === 'row') paintRow(entry.element, item, entry.card);
      else paintDetail(entry.element, item, entry.card);
    });
  } finally {
    state.running = false;
    if (state.again) {
      state.again = false;
      schedule();
    }
  }
}

function schedule() {
  if (state.timer) return;
  state.timer = setTimeout(() => {
    state.timer = 0;
    priceUnpriced().catch((error) => console.warn('[uvsp] card pricing failed:', error));
  }, SCAN_DELAY_MS);
}

/* ------------------------------------------------------------------- entry */

function reset() {
  // Only remove what this renderer owns: a deck page also has .uvsp-chip
  // elements, painted by deck.js, and those must survive a settings change.
  for (const box of document.querySelectorAll('.uvsp-cardprice')) box.remove();
  for (const chip of document.querySelectorAll('.card-important-info > .uvsp-chip')) chip.remove();
  for (const element of document.querySelectorAll('[data-uvsp-priced]')) {
    delete element.dataset[MARK];
  }
  schedule();
}

function start() {
  schedule();

  // AJAX results replace #content; the colorbox inserts a card page later.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (
          node.matches?.('.card, .card_infos') ||
          node.querySelector?.('.card, .card_infos')
        ) {
          schedule();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  onSettingsChanged((patch) => {
    if (patch.metric) state.metric = normalizeMetric(patch.metric);
    if ('showUnmatched' in patch) state.showUnmatched = patch.showUnmatched !== false;
    reset();
  });
}

loadSettings().then((settings) => {
  state.metric = normalizeMetric(settings.metric);
  state.showUnmatched = settings.showUnmatched !== false;
  start();
});
