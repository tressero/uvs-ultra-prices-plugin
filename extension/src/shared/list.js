/**
 * Parse the deck cards on list pages.
 *
 * The same `.deck-list-deck` template is used by topdecks.php, leaf folders
 * (folder.php) and user pages, so one parser covers all three:
 *
 *   <div class="deck-list-deck">
 *     <div class="deck-list-deck-stats">...</div>
 *     <a class="deck-list-deck-image" href="deck.php?deck=abc">...</a>
 *     <div class="deck-list-deck-info">
 *       <span><a href="deck.php?deck=abc">Grog | Earth</a></span>
 *       <span><span class="label label-success">Standard</span>
 *             <span class="label label-info">71 cards</span></span>
 *     </div>
 *   </div>
 */
import { deckIdFromUrl } from './parse.js';

export const DECK_CARD_SELECTOR = '.deck-list-deck';

export function parseDeckCard(element) {
  const link = element.querySelector('a[href*="deck.php?deck="]');
  const deckId = link ? deckIdFromUrl(link.getAttribute('href')) : null;
  if (!deckId) return null;

  const info = element.querySelector('.deck-list-deck-info');
  const nameLink = info?.querySelector('a');
  const countLabel = [...(info?.querySelectorAll('.label') ?? [])].find((label) =>
    /cards?$/i.test(label.textContent.trim()),
  );

  return {
    deckId,
    element,
    info,
    // The row that already holds the format and card-count labels.
    labelRow: countLabel?.parentElement ?? null,
    name: nameLink ? nameLink.textContent.trim() : null,
    cardCount: countLabel ? Number.parseInt(countLabel.textContent, 10) || null : null,
  };
}

export function parseDeckList(root = document) {
  return [...root.querySelectorAll(DECK_CARD_SELECTOR)].map(parseDeckCard).filter(Boolean);
}
