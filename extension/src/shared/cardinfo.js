/**
 * Parse the two card surfaces that are not deck rows:
 *
 *   Search results (index.php, loaded by listing_cards.php)
 *     <div class="card even">
 *       <div onmouseover="preview2('cr02', '007', 'character');">
 *         <div class="card_image"><img src="images/extensions/cr02/007-mini.jpg"/></div>
 *         <div class="card_infos">
 *           <div class="card_title" onclick="...card.php?id=11619">
 *             <h1>Grog Strongjaw, Mighty Half-Giant</h1>
 *             <div class="card-important-info">
 *               <span class="label card-list-character">Character</span><br />Uncommon
 *             </div>
 *           </div>
 *           <div class="card_division cd1">Set 62 - ... #7</div>
 *         </div>
 *       </div>
 *     </div>
 *
 *   Card page (card.php in the colorbox, or showcard.php)
 *     <div class="card_image"><img src="images/extensions/cr02/007-preview.jpg"/></div>
 *     <div class="card_infos">
 *       <div class="card_title"><h1>...</h1></div>
 *       <div class="card_division cd1">Set 62 - ... #7<br />Character<br />Uncommon</div>
 *       ...
 *     </div>
 *
 * Set code and collector number are on the hover handler in search results and
 * in the image path in both places. Both pages also print the rarity, so no
 * extra card-page request is needed for an estimate.
 */
import { collectorNumberInt } from '../../../shared/text.js';
import { parseRarityFromCardPage } from '../../../shared/rarity.js';

const IMAGE_PATH = /extensions\/([a-z0-9]+)\/(\d+)[-_][^/]*$/i;

function clean(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function setAndNumberFromHover(root) {
  const hover =
    root.getAttribute?.('onmouseover') ||
    root.querySelector?.('[onmouseover]')?.getAttribute('onmouseover') ||
    '';
  const match = hover.match(/preview2?\(\s*'([a-z0-9]+)'\s*,\s*'([0-9A-Za-z]+)'/i);
  return match ? { setCode: match[1].toLowerCase(), number: match[2] } : null;
}

function setAndNumberFromImage(image) {
  const src = image?.getAttribute?.('src') || image?.src || '';
  const match = src.match(IMAGE_PATH) || src.match(/extensions\/([a-z0-9]+)\/(\d+)/i);
  return match ? { setCode: match[1].toLowerCase(), number: match[2] } : null;
}

function cardIdFromLinks(root) {
  const link = root.querySelector('a[href*="card.php?id="], a[href*="showcard.php?id="]');
  const match = link?.getAttribute('href')?.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}

/** The right block prints "Character" then "Uncommon" on the next line. */
function rarityFromImportantInfo(root) {
  const info = root.querySelector('.card-important-info');
  if (!info) return null;
  const clone = info.cloneNode(true);
  for (const label of clone.querySelectorAll('.label')) label.remove();
  return clean(clone.textContent) || null;
}

function baseCard(name, setAndNumber, root) {
  return {
    cardId: cardIdFromLinks(root),
    name,
    setCode: setAndNumber?.setCode ?? null,
    number: setAndNumber?.number ?? null,
    numberInt: collectorNumberInt(setAndNumber?.number),
    qty: 1,
    type: null,
  };
}

/** One search result row -> card, or null when it is not a card row. */
export function parseSearchCard(row) {
  const name = clean(row.querySelector('.card_title h1')?.textContent);
  if (!name) return null;

  const image = row.querySelector('.card_image img') ?? row.querySelector('img');
  const setAndNumber = setAndNumberFromHover(row) ?? setAndNumberFromImage(image);
  return {
    ...baseCard(name, setAndNumber, row),
    rarity: rarityFromImportantInfo(row),
    element: row,
  };
}

export function parseSearchCards(root = document) {
  // On index.php the results live in #content; a saved fragment is its own root.
  const scope = root.querySelector?.('#content') ?? root;
  return [...scope.querySelectorAll('.card')].map(parseSearchCard).filter(Boolean);
}

/** One card page -> card, or null. `infos` is the .card_infos block. */
export function parseDetailCard(infos) {
  const name = clean(infos.querySelector('.card_title h1')?.textContent);
  if (!name) return null;

  // The image sits beside .card_infos, not inside it.
  const container = infos.parentElement ?? infos;
  const image =
    container.querySelector('.card_image img') ??
    container.querySelector('img.preview_image') ??
    infos.querySelector('img');
  const setAndNumber = setAndNumberFromImage(image);
  return {
    ...baseCard(name, setAndNumber, infos),
    rarity: parseRarityFromCardPage(infos.outerHTML),
    element: infos,
  };
}

/** Card pages currently in the document: a colorbox fragment or showcard.php. */
export function parseDetailCards(root = document) {
  return [...root.querySelectorAll('.card_infos')]
    // Search rows also contain .card_infos; those are handled as rows.
    .filter((infos) => !infos.closest('.card'))
    .map(parseDetailCard)
    .filter(Boolean);
}
