import { describe, expect, it } from 'vitest';
import { parseDeckCard, parseDeckList } from '../../extension/src/shared/list.js';
import { loadFixture } from '../helpers/fixtures.js';

describe('parseDeckList', () => {
  it('finds every deck card on the top decks page', () => {
    const doc = loadFixture('topdecks');
    const expected = doc.querySelectorAll('.deck-list-deck').length;
    const cards = parseDeckList(doc);
    const ids = cards.map((card) => card.deckId);
    expect(expected).toBeGreaterThan(30);
    expect(cards).toHaveLength(expected);
    expect(ids.every(Boolean)).toBe(true);
    // topdecks.php repeats decks across sections ("Most liked", "Most viewed"),
    // which is why the renderer dedupes by deck id before pricing anything.
    expect(new Set(ids).size).toBeGreaterThan(20);
    expect(new Set(ids).size).toBeLessThanOrEqual(expected);
  });

  it('works on leaf folders, which use the same template', () => {
    const doc = loadFixture('folder-decks');
    const expected = doc.querySelectorAll('.deck-list-deck').length;
    const cards = parseDeckList(doc);
    expect(expected).toBeGreaterThan(10);
    expect(cards).toHaveLength(expected);
    expect(cards.every((card) => /^[A-Za-z0-9]+$/.test(card.deckId))).toBe(true);
  });

  it('reads the deck name and card count shown on the card', () => {
    const doc = loadFixture('topdecks');
    const [first] = parseDeckList(doc);
    const link = doc.querySelector('.deck-list-deck .deck-list-deck-info a');
    expect(first.name).toBe(link.textContent.trim());
    expect(first.cardCount).toBeGreaterThan(0);
    expect(first.cardCount).toBeLessThan(200);
  });

  it('finds the row that holds the format labels, so a price can join that line', () => {
    const [first] = parseDeckList(loadFixture('topdecks'));
    expect(first.labelRow).toBeTruthy();
    expect(first.labelRow.querySelectorAll('.label')).toHaveLength(2);
    expect(first.labelRow.textContent).toMatch(/\d+ cards/);
  });

  it('ignores markup that is not a deck card', () => {
    const doc = loadFixture('topdecks');
    const total = doc.querySelectorAll('.deck-list-deck').length;

    const bogus = doc.createElement('div');
    bogus.className = 'deck-list-deck';
    bogus.innerHTML = '<div class="deck-list-deck-info"><span>no link here</span></div>';
    doc.body.append(bogus);

    expect(parseDeckCard(bogus)).toBeNull();
    expect(parseDeckList(doc)).toHaveLength(total);
  });
});
