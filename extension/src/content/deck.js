/**
 * Deck page renderer: one price chip per card row, plus a summary panel.
 *
 * Pricing happens in the background service worker; this script parses the DOM,
 * asks for prices, and renders. Cards TCGplayer has no price for get a clearly
 * marked placeholder based on their rarity, fetched from the card's page.
 */
import { parseDeckCards, DECK_CARD_SELECTOR } from '../shared/parse.js';
import { loadSettings, onSettingsChanged } from '../shared/settings.js';
import { money, confidenceLabel, productUrl, shortDate } from '../shared/format.js';
import { placeholderFor } from '../../../shared/rarity.js';
import { estimateTotals, needsRarity } from '../../../shared/estimate.js';
import { resolveRarities } from './rarities.js';

const CHIP_CLASS = 'uvsp-chip';
const PANEL_ID = 'uvsp-panel';

/** Rarities resolved this page load, by UVS card id. */
const placeholders = new Map();

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
      import('../../../shared/match.js'),
      import('../shared/catalog.js'),
    ]);
    const catalog = await loadBundledCatalog();
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

/** Placeholder value for an unpriced card, or null when we have no rarity. */
function placeholderValue(item) {
  if (item.unit != null) return null;
  if (item.match?.rarity) return placeholderFor(item.match.rarity);
  const known = placeholders.get(item.card.cardId);
  return known ? placeholderFor(known) : null;
}

function placeholderRarity(item) {
  return item.match?.rarity ?? placeholders.get(item.card.cardId) ?? null;
}

function chipFor(item, metric) {
  // Matched and priced: a real number, linked to the product page.
  if (item.unit != null) {
    const chip = document.createElement('a');
    chip.className = CHIP_CLASS;
    chip.href = productUrl(item.match);
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

  const link = item.match?.id ? productUrl(item.match) : null;
  const searchable = item.reason !== 'set-not-mapped';
  const rarity = placeholderRarity(item);
  const value = placeholderValue(item);

  // No price, but we know the rarity: show a placeholder, marked as one.
  if (value != null) {
    const chip = document.createElement('a');
    chip.className = `${CHIP_CLASS} uvsp-chip--est`;
    chip.textContent = `${money(value)}(?)`;
    chip.href = link ?? tcgSearchUrl(item.card.name);
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.title = [
      `Placeholder ${money(value)} — no TCGplayer price`,
      `${rarity} · ${REASON_TEXT[item.reason] ?? 'not listed'}`,
      'Click to check TCGplayer',
    ].join(' · ');
    return chip;
  }

  // Matched but unpriced, or not matched at all, and no rarity known yet.
  const chip = document.createElement(link || searchable ? 'a' : 'span');
  chip.className = `${CHIP_CLASS} uvsp-chip--none`;
  chip.textContent = 'n/a';
  chip.title = link
    ? `${item.match.name} — ${REASON_TEXT[item.reason] ?? 'no price'}`
    : `${REASON_TEXT[item.reason] ?? 'No TCGplayer listing found'}`;
  if (link) {
    chip.href = link;
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

function renderPanel(quote, items, uniqueCards, metric, settled) {
  const existing = document.getElementById(PANEL_ID);
  const panel = existing ?? document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'uvsp-panel';
  panel.replaceChildren();

  const { totals } = quote;
  const other = metric === 'market' ? 'low' : 'market';
  const priced = totals.pricedCards;
  const est = estimateTotals(items, {
    rarityFor: (item) => item.match?.rarity ?? placeholders.get(item.card.cardId) ?? null,
    realTotal: totals[metric] ?? 0,
  });
  const { estimated, estimatedCards, estimatedQty, unknownCards, unknownQty, combined, realTotal } = est;

  const headline = document.createElement('div');
  headline.className = 'uvsp-panel-headline';

  const label = document.createElement('span');
  label.className = 'uvsp-label';
  label.textContent = metric === 'low' ? 'TCGplayer low' : 'TCGplayer market';
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
    sub.textContent = `TCGplayer ${money(realTotal)} + ${money(estimated)} placeholder`;
  } else if (pending) {
    sub.textContent = `checking rarity for ${unknownCards} unpriced card${unknownCards === 1 ? '' : 's'}…`;
  } else if (!priced) {
    sub.textContent = 'no prices';
  } else if (totals.complete) {
    sub.textContent = `${other} ${money(totals[other])}`;
  } else {
    sub.textContent = `${priced} of ${uniqueCards} cards priced`;
  }

  headline.append(label, total, sub);
  panel.append(headline);

  if (estimateReady) {
    panel.append(
      noteLine(
        `${estimatedCards} card${estimatedCards === 1 ? '' : 's'} (${estimatedQty} cop` +
          `${estimatedQty === 1 ? 'y' : 'ies'}) had no TCGplayer price and used a placeholder: ` +
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
    panel.append(
      noteLine(
        `${totals.estimatedCards} card${totals.estimatedCards === 1 ? '' : 's'} ` +
          `used ${other === 'low' ? 'lowest listing' : 'market price'} (no ${metric} price).`,
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
    card.element.append(chipFor(item, metric));
  });

  renderPanel({ ...quote, hint: hintFor(quote.items) }, quote.items, cards.length, metric, settled);

  // The row click opens the card popup; keep the price chip from triggering it.
  for (const chip of document.querySelectorAll(`.${CHIP_CLASS}`)) {
    chip.addEventListener('click', (event) => event.stopPropagation());
  }
}

/**
 * Ask for prices, then fill in placeholders for whatever has no listing.
 * Rarities arrive asynchronously, so the page repaints instead of re-quoting.
 */
async function render() {
  const cards = parseDeckCards(document);
  if (!cards.length) return;

  const settings = await loadSettings();
  const metric = settings.metric === 'low' ? 'low' : 'market';
  const quote = await requestQuote(cards, metric);
  if (!quote?.ok) return;

  const missing = needsRarity(quote.items);

  let settled = missing.length === 0;
  let pending = missing.length;
  let frame = 0;

  const repaint = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
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
    if (settled) return;
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
