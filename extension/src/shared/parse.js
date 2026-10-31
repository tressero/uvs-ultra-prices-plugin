/**
 * Parse UVS Ultra deck markup.
 *
 * The site renders each card as:
 *
 *   <li id="deck-card-12875" class="card-list card-list-character"
 *       onmouseover="...preview_listing_deck2('ft01', '010', 'character')...">
 *     <img src="images/extensions/ft01/010-ci-micro.jpg" class="ci-micro_image"/>
 *     Lucy Heartfilia, Celestial Wizard
 *     <span class="badge badge-success">x<span id="number_card_12875">1</span></span>
 *     <span class="badge badge-warning deck-card-format-info">L</span>
 *   </li>
 *
 * Everything a price lookup needs (set, collector number, name, quantity) is
 * already in that row, so no extra request is needed per card.
 */

export const DECK_CARD_SELECTOR = 'li[id^="deck-card-"]';

/** Deck id from a deck link or the current URL. */
export function deckIdFromUrl(href) {
  const match = String(href ?? '').match(/deck\.php\?deck=([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * The card name is the loose text between the thumbnail and the first badge.
 * Reading child nodes (not textContent) keeps the badges out of the name.
 */
function nameOf(li) {
  let text = '';
  for (const node of li.childNodes) {
    if (node.nodeType === 1) {
      if (node.classList && node.classList.contains('badge')) break;
      if (node.tagName === 'IMG') continue;
    }
    text += node.textContent ?? '';
  }
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Set code and collector number come from the hover handler, which the site
 * always emits. The thumbnail path carries the same data and is used as a
 * fallback in case the inline handler is ever refactored.
 */
function setAndNumber(li) {
  const handler = li.getAttribute('onmouseover') || '';
  let match = handler.match(
    /preview_listing_deck2\(\s*'([a-z0-9]+)'\s*,\s*'([0-9A-Za-z]+)'/i,
  );
  if (match) return { setCode: match[1].toLowerCase(), number: match[2] };

  const img = li.querySelector('img');
  const src = img ? img.getAttribute('src') || '' : '';
  match = src.match(/extensions\/([a-z0-9]+)\/(\d+)[-_]/i);
  if (match) return { setCode: match[1].toLowerCase(), number: match[2] };

  return { setCode: null, number: null };
}

function quantityOf(li) {
  for (const el of li.querySelectorAll('[id]')) {
    if (/^number_card[_-]\d+$/.test(el.id)) {
      const value = Number.parseInt(el.textContent.trim(), 10);
      if (Number.isFinite(value)) return value;
    }
  }
  // Fallback: the "x4" badge.
  const badge = li.querySelector('.badge-success');
  if (badge) {
    const value = Number.parseInt((badge.textContent || '').replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(value)) return value;
  }
  return 1;
}

function typeOf(li) {
  for (const cls of li.classList) {
    const match = cls.match(/^card-list-([a-z]+)$/);
    if (match && match[1] !== 'xsmall' && match[1] !== 'small') return match[1];
  }
  return null;
}

/** "010" -> 10, "7/211" -> 7. Returns null when there is no leading number. */
export function collectorNumberInt(value) {
  const match = String(value ?? '').match(/^0*(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

/** One card row -> plain object. Throws away anything unparseable. */
export function parseCardRow(li) {
  const name = nameOf(li);
  if (!name) return null;
  const { setCode, number } = setAndNumber(li);
  return {
    cardId: (li.id || '').replace(/^deck-card-/, '') || null,
    name,
    setCode,
    number,
    numberInt: collectorNumberInt(number),
    qty: quantityOf(li),
    type: typeOf(li),
    element: li,
  };
}

export function parseDeckCards(root = document) {
  return [...root.querySelectorAll(DECK_CARD_SELECTOR)].map(parseCardRow).filter(Boolean);
}

/** Deck name and format, used in the summary panel. */
export function parseDeckMeta(root = document) {
  const nameEl = root.querySelector('#name');
  const formatEl = root.querySelector('.deck-info-format');
  const href = root.location?.href ?? '';
  return {
    name: nameEl ? nameEl.textContent.trim() : null,
    format: formatEl ? formatEl.textContent.trim().replace(/\s+/g, ' ') : null,
    deckId: deckIdFromUrl(href),
  };
}
