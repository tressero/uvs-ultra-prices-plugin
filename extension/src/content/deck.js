/**
 * Deck page renderer: one price chip per card row, plus a summary panel.
 *
 * Pricing happens in the background service worker; this script parses the DOM,
 * asks for prices, and renders. Cards TCGplayer has no price for get a clearly
 * marked estimate based on their rarity, fetched from the card's page.
 */
import { parseDeckCards, DECK_CARD_SELECTOR } from '../shared/parse.js';
import { loadSettings, onSettingsChanged } from '../shared/settings.js';
import { money, moneyWhole, shortDate } from '../shared/format.js';
import { requestQuote } from '../shared/quote.js';
import { estimateTotals, needsRarity } from '../../../shared/estimate.js';
import { selectForMassEntry } from '../../../shared/massentry.js';
import { FIELD_LABEL, METRICS, METRIC_LABEL, normalizeMetric } from '../../../shared/metrics.js';
import { chipFor, CHIP_CLASS } from './chip.js';
import { startBuyFlow } from './buy.js';
import { resolveRarities } from './rarities.js';

const PANEL_ID = 'uvsp-panel';

/** Page-only metric choice. Not persisted; a reload returns to the setting. */
let metricOverride = null;

/** Guards against a slow quote for the previous metric repainting the page. */
let renderToken = 0;

/** Rarities resolved this page load, by UVS card id. */
const placeholders = new Map();

/** Placeholder rarity for an unpriced card, or null when we have none. */
function placeholderRarity(item) {
  return item.match?.rarity ?? placeholders.get(item.card.cardId) ?? null;
}

function noteLine(text, variant) {
  const note = document.createElement('div');
  note.className = 'uvsp-panel-note' + (variant ? ` uvsp-panel-note--${variant}` : '');
  note.textContent = text;
  return note;
}

/**
 * "Buy deck on TCGplayer": opens Mass Entry with only the cards that have a real
 * price. Missing cards are listed in a dialog first.
 */
function buyAction(items, totalCards) {
  const { included, excluded } = selectForMassEntry(items);
  const includedCopies = included.reduce((sum, item) => sum + (Number(item.card?.qty) || 1), 0);

  const row = document.createElement('div');
  row.className = 'uvsp-panel-actions';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'uvsp-buy';
  button.textContent = 'Buy deck on TCGplayer';
  button.title = includedCopies
    ? `Opens TCGplayer Mass Entry with ${includedCopies} priced card${includedCopies === 1 ? '' : 's'} — press Add to Cart there.`
    : 'No card in this deck has a TCGplayer price yet.';
  button.addEventListener('click', () => startBuyFlow(items));

  const note = document.createElement('span');
  note.className = 'uvsp-buy-note';
  note.textContent = excluded.length
    ? `Mass Entry · ${includedCopies} of ${totalCards} cards · ${excluded.length} left out.`
    : `Mass Entry · ${totalCards} card${totalCards === 1 ? '' : 's'} — press Add to Cart there.`;

  row.append(button, note);
  return row;
}

/** Page-only metric selector. Changing it never writes the saved setting. */
function metricRow(selected) {
  const row = document.createElement('div');
  row.className = 'uvsp-metric';

  const label = document.createElement('label');
  label.className = 'uvsp-metric-label';
  label.append('Price ');

  const select = document.createElement('select');
  select.className = 'uvsp-metric-select';
  select.title = 'Changes this page only. Set your default in the extension popup.';
  for (const metric of METRICS) {
    const option = document.createElement('option');
    option.value = metric;
    option.textContent = METRIC_LABEL[metric];
    select.append(option);
  }
  select.value = selected;
  select.addEventListener('change', () => {
    metricOverride = normalizeMetric(select.value);
    render().catch((error) => console.warn('[uvsp] metric change failed:', error));
  });

  label.append(select);
  const note = document.createElement('span');
  note.className = 'uvsp-metric-note';
  note.textContent = 'This page only';

  row.append(label, note);
  return row;
}

function renderPanel(quote, items, uniqueCards, metric, settled) {
  const existing = document.getElementById(PANEL_ID);
  const panel = existing ?? document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'uvsp-panel';
  panel.replaceChildren();

  const selected = normalizeMetric(metric);
  const others = METRICS.filter((name) => name !== selected);
  const { totals } = quote;
  const priced = totals.pricedCards;
  const est = estimateTotals(items, {
    rarityFor: (item) => item.match?.rarity ?? placeholders.get(item.card.cardId) ?? null,
    realTotal: totals[selected] ?? totals.market ?? 0,
  });
  const { estimated, estimatedCards, estimatedQty, unknownCards, unknownQty, combined, realTotal } = est;

  const headline = document.createElement('div');
  headline.className = 'uvsp-panel-headline';

  const label = document.createElement('span');
  label.className = 'uvsp-label';
  label.textContent = `TCGplayer ${METRIC_LABEL[selected]}`;
  const pending = unknownCards > 0 && !settled;
  const estimateReady = estimated > 0 && settled;

  const total = document.createElement('span');
  total.className = 'uvsp-total';
  if (priced || estimateReady) {
    total.textContent = `${estimateReady ? '≈ ' : ''}${money(estimateReady ? combined : realTotal)}`;
  } else {
    // Never print $0.00 for a deck we could not price — that reads as "free".
    total.textContent = '—';
  }
  if (estimateReady) total.classList.add('uvsp-total--estimated');
  if (unknownCards) total.classList.add('uvsp-total--partial');

  const sub = document.createElement('span');
  sub.className = 'uvsp-sub';
  if (estimateReady) {
    sub.textContent = `TCGplayer ${money(realTotal)} + ${moneyWhole(estimated)} estimate`;
  } else if (pending) {
    sub.textContent = `checking rarity for ${unknownCards} unpriced card${unknownCards === 1 ? '' : 's'}…`;
  } else if (!priced) {
    sub.textContent = 'no prices';
  } else if (totals.complete) {
    sub.textContent = others.map((name) => `${METRIC_LABEL[name]} ${money(totals[name])}`).join(' · ');
  } else {
    sub.textContent = `${priced} of ${uniqueCards} cards priced`;
  }

  headline.append(label, total, sub);
  panel.append(headline);
  panel.append(metricRow(selected));

  const buy = buyAction(items, totals.totalCards);
  if (buy) panel.append(buy);

  if (estimateReady) {
    panel.append(
      noteLine(
        `${estimatedCards} card${estimatedCards === 1 ? '' : 's'} (${estimatedQty} cop` +
          `${estimatedQty === 1 ? 'y' : 'ies'}) had no TCGplayer price and used an estimate: ` +
          `common/uncommon/rare $1, ultra rare $15, secret rare $30.`,
        'estimate',
      ),
    );
  }

  if (unknownCards && !pending) {
    panel.append(
      noteLine(
        `${unknownCards} card${unknownCards === 1 ? '' : 's'} (${unknownQty} cop` +
          `${unknownQty === 1 ? 'y' : 'ies'}) still have no price` +
          (estimated ? ' — the total is a lower bound.' : '.'),
        'warn',
      ),
    );
  }

  if (!priced && !estimated) {
    panel.append(noteLine(quote.hint ?? 'No TCGplayer prices available for this deck.', 'warn'));
  }

  if (totals.estimatedCards) {
    const sources = [
      ...new Set(
        items
          .filter((item) => item.estimated)
          .map((item) => FIELD_LABEL[item.unitSource])
          .filter(Boolean),
      ),
    ];
    panel.append(
      noteLine(
        `${totals.estimatedCards} card${totals.estimatedCards === 1 ? '' : 's'} ` +
          `used ${sources.join(' or ') || 'a fallback price'} (no ${METRIC_LABEL[selected]} price).`,
      ),
    );
  }

  if (quote.updatedAt) {
    panel.append(noteLine(`Prices from TCGplayer via tcgcsv, updated ${shortDate(quote.updatedAt)}.`));
  }

  if (!existing) {
    const anchor = document.querySelector('.deck-header');
    if (anchor) anchor.append(panel);
    else document.querySelector('.deck-sort')?.after(panel);
  }
}

/** Explanation shown when nothing at all could be priced (e.g. a presale set). */
function hintFor(items) {
  if (!items.length) return null;
  const unmapped = items.filter((item) => item.reason === 'set-not-mapped');
  if (unmapped.length === items.length) {
    return 'This deck is from a set TCGplayer has no singles for yet (presale or not carried).';
  }
  const sets = [...new Set(unmapped.map((item) => item.card.setCode).filter(Boolean))];
  if (sets.length) return `No TCGplayer listing for set${sets.length === 1 ? '' : 's'} ${sets.join(', ')}.`;
  return null;
}

/** Paint chips and the panel from the current quote (no new requests). */
function paint(quote, cards, settings, metric, settled = true) {
  quote.items.forEach((item, index) => {
    const card = cards[index];
    if (!card) return;
    card.element.querySelector(`.${CHIP_CLASS}`)?.remove();
    if (item.unit == null && !settings.showUnmatched) return;
    card.element.append(chipFor(item, metric, { rarity: placeholderRarity(item) }));
  });

  renderPanel({ ...quote, hint: hintFor(quote.items) }, quote.items, cards.length, metric, settled);

  // The row click opens the card popup; keep the price chip from triggering it.
  for (const chip of document.querySelectorAll(`.${CHIP_CLASS}`)) {
    chip.addEventListener('click', (event) => event.stopPropagation());
  }
}

/**
 * Ask for prices, then fill in estimates for whatever has no listing.
 * Rarities arrive asynchronously, so the page repaints instead of re-quoting.
 */
async function render() {
  const cards = parseDeckCards(document);
  if (!cards.length) return;

  const token = ++renderToken;
  const settings = await loadSettings();
  const metric = metricOverride ?? normalizeMetric(settings.metric);
  const quote = await requestQuote(cards, metric);
  if (!quote?.ok || token !== renderToken) return;

  const missing = needsRarity(quote.items);

  let settled = missing.length === 0;
  let pending = missing.length;
  let frame = 0;

  const repaint = () => {
    if (frame || token !== renderToken) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (token !== renderToken) return;
      paint(quote, cards, settings, metric, settled);
    });
  };

  paint(quote, cards, settings, metric, settled);
  if (settled) return;

  const onResolved = (found) => {
    for (const [cardId, rarity] of found) {
      if (!placeholders.has(cardId)) placeholders.set(cardId, rarity);
    }
    pending -= found.size;
    if (pending <= 0) settled = true;
    repaint();
  };

  await resolveRarities(missing, { max: 60, onResolved });

  // A card page that fails to load must not leave the total in limbo.
  setTimeout(() => {
    if (settled || token !== renderToken) return;
    settled = true;
    repaint();
  }, 6000);
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    render().catch((error) => console.warn('[uvsp] render failed:', error));
  });
}

function start() {
  if (!document.querySelector(DECK_CARD_SELECTOR)) return;
  schedule();

  // The site re-sorts and re-renders the list without a full reload.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.(DECK_CARD_SELECTOR) || node.querySelector?.(DECK_CARD_SELECTOR)) {
          schedule();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  onSettingsChanged(() => schedule());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
