/**
 * Deck page renderer: one price chip per card row, plus a summary panel.
 *
 * Pricing happens in the background service worker (M1: in a pricing worker
 * service). This script only parses the DOM, asks for prices, and renders.
 */
import { parseDeckCards, DECK_CARD_SELECTOR } from '../shared/parse.js';
import { loadSettings, onSettingsChanged } from '../shared/settings.js';
import { money, confidenceLabel } from '../shared/format.js';

const CHIP_CLASS = 'uvsp-chip';
const PANEL_ID = 'uvsp-panel';

/** Plain object for messaging: DOM nodes cannot cross the runtime boundary. */
function serialize(cards) {
  return cards.map(({ element, ...rest }) => rest);
}

async function requestQuote(cards, metric) {
  const plain = serialize(cards);

  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'quote', cards: plain, metric });
      if (response?.ok) return response;
      console.warn('[uvsp] quote failed:', response?.error);
    } catch (error) {
      console.warn('[uvsp] worker unreachable:', error);
    }
  }

  // Dev/preview fallback: price in-page against the bundled snapshot.
  if (__DEV__) {
    const [{ priceDeck }, { loadBundledCatalog }] = await Promise.all([
      import('../shared/match.js'),
      import('../shared/catalog.js'),
    ]);
    const catalog = loadBundledCatalog();
    return { ok: true, ...priceDeck(plain, catalog, { metric }), updatedAt: catalog.updatedAt };
  }
  return { ok: false, error: 'no price source' };
}

function tcgSearchUrl(name) {
  return `https://www.tcgplayer.com/search/universus/product?q=${encodeURIComponent(name)}`;
}

const REASON_TEXT = {
  'set-not-mapped': 'This set has no TCGplayer singles yet (presale or not carried)',
  'group-missing': 'No TCGplayer data loaded for this set',
  'no-product': 'Not found on TCGplayer',
  'no-price': 'Listed on TCGplayer, but with no price',
};

function chipFor(item, metric) {
  // Matched and priced: a real number, linked to the product page.
  if (item.unit != null) {
    const chip = document.createElement('a');
    chip.className = CHIP_CLASS;
    chip.href = item.match.url;
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.textContent = money(item.unit);

    const title = [`${item.match.name} — TCGplayer`];
    title.push(`market ${money(item.match.market)}`, `low ${money(item.match.low)}`);
    if (item.estimated) {
      title.push(metric === 'market' ? 'no market price, showing lowest' : 'no low price, showing market');
    }
    if (item.confidence !== 'exact') title.push(`match: ${confidenceLabel(item.confidence)}`);
    chip.title = title.filter(Boolean).join(' · ');

    if (item.confidence === 'fuzzy' || item.confidence === 'number') {
      chip.classList.add('uvsp-chip--unsure');
    }
    return chip;
  }

  // Matched but unpriced, or not matched at all.
  const searchable = item.reason !== 'set-not-mapped';
  const chip = document.createElement(searchable ? 'a' : 'span');
  chip.className = `${CHIP_CLASS} uvsp-chip--none`;
  chip.textContent = 'n/a';
  chip.title = item.match?.url
    ? `${item.match.name} — ${REASON_TEXT[item.reason] ?? 'no price'}`
    : `${REASON_TEXT[item.reason] ?? 'No TCGplayer listing found'}`;
  if (item.match?.url) {
    chip.href = item.match.url;
  } else if (searchable) {
    chip.href = tcgSearchUrl(item.card.name);
    chip.title += ' — search TCGplayer';
  }
  if (chip.tagName === 'A') {
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
  }
  return chip;
}

function noteLine(text, variant) {
  const note = document.createElement('div');
  note.className = 'uvsp-panel-note' + (variant ? ` uvsp-panel-note--${variant}` : '');
  note.textContent = text;
  return note;
}

function renderPanel(quote, uniqueCards) {
  const existing = document.getElementById(PANEL_ID);
  const panel = existing ?? document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'uvsp-panel';
  panel.replaceChildren();

  const { totals } = quote;
  const metric = totals.metric ?? 'market';
  const other = metric === 'market' ? 'low' : 'market';
  const priced = totals.pricedCards;

  const headline = document.createElement('div');
  headline.className = 'uvsp-panel-headline';

  const label = document.createElement('span');
  label.className = 'uvsp-label';
  label.textContent = metric === 'low' ? 'TCGplayer low' : 'TCGplayer market';

  const total = document.createElement('span');
  total.className = 'uvsp-total';
  // Never print $0.00 for a deck we could not price — that reads as "free".
  total.textContent = priced ? money(totals[metric]) : '—';
  if (!totals.complete && priced) total.classList.add('uvsp-total--partial');

  const sub = document.createElement('span');
  sub.className = 'uvsp-sub';
  if (!priced) sub.textContent = 'no prices';
  else if (totals.complete) sub.textContent = `${other} ${money(totals[other])}`;
  else sub.textContent = `${priced} of ${uniqueCards} cards priced`;

  headline.append(label, total, sub);
  panel.append(headline);

  if (!priced) {
    panel.append(noteLine(quote.hint ?? 'No TCGplayer prices available for this deck.', 'warn'));
  } else if (!totals.complete) {
    const coverage = totals.coverage;
    const text =
      coverage < 0.5
        ? `Only ${priced} of ${uniqueCards} cards priced — this total covers a minority of the deck.`
        : `${uniqueCards - priced} card${uniqueCards - priced === 1 ? '' : 's'} without a TCGplayer price ` +
          `(${totals.unpricedQty} cop${totals.unpricedQty === 1 ? 'y' : 'ies'}) — total is a lower bound.`;
    panel.append(noteLine(text, 'warn'));
  }

  if (totals.estimatedCards) {
    panel.append(
      noteLine(
        `${totals.estimatedCards} card${totals.estimatedCards === 1 ? '' : 's'} ` +
          `used ${other === 'low' ? 'lowest listing' : 'market price'} (no ${metric} price).`,
      ),
    );
  }

  if (quote.updatedAt) {
    panel.append(noteLine(`Prices from TCGplayer via tcgcsv, updated ${quote.updatedAt}.`));
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

async function render() {
  const cards = parseDeckCards(document);
  if (!cards.length) return;

  const settings = await loadSettings();
  const metric = settings.metric === 'low' ? 'low' : 'market';
  const quote = await requestQuote(cards, metric);
  if (!quote?.ok) return;

  quote.items.forEach((item, index) => {
    const card = cards[index];
    if (!card) return;
    card.element.querySelector(`.${CHIP_CLASS}`)?.remove();
    if (item.unit == null && !settings.showUnmatched) return;
    card.element.append(chipFor(item, metric));
  });

  renderPanel({ ...quote, hint: hintFor(quote.items) }, cards.length);

  // The row click opens the card popup; keep the price chip from triggering it.
  for (const chip of document.querySelectorAll(`.${CHIP_CLASS}`)) {
    chip.addEventListener('click', (event) => event.stopPropagation());
  }
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
