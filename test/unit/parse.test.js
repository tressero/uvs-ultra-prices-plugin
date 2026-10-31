import { describe, expect, it } from 'vitest';
import {
  collectorNumberInt,
  deckIdFromUrl,
  parseCardRow,
  parseDeckCards,
  parseDeckMeta,
} from '../../extension/src/shared/parse.js';
import { loadFixture } from '../helpers/fixtures.js';

describe('parseDeckCards', () => {
  it('reads every card row of a saved deck page', () => {
    const cards = parseDeckCards(loadFixture('deck-grog'));
    expect(cards).toHaveLength(29);
    expect(cards.reduce((sum, card) => sum + card.qty, 0)).toBe(71);
  });

  it('keeps name, set, collector number and quantity together', () => {
    const [first] = parseDeckCards(loadFixture('deck-grog'));
    expect(first).toMatchObject({
      name: 'Grog Strongjaw, Mighty Half-Giant',
      setCode: 'cr02',
      number: '007',
      numberInt: 7,
      qty: 1,
      type: 'character',
    });
  });

  it('never lets badge text leak into the card name', () => {
    for (const card of parseDeckCards(loadFixture('deck-jp'))) {
      expect(card.name).not.toMatch(/\bx\d+\b/);
      expect(card.name).not.toMatch(/^[A-Z]{1,2}$/);
      expect(card.name.length).toBeGreaterThan(2);
    }
  });

  it('parses the compact deck_card_list fragment identically', () => {
    const full = parseDeckCards(loadFixture('deck-lucy'));
    const fragment = parseDeckCards(loadFixture('deck-lucy-list'));
    expect(fragment.map((c) => [c.name, c.setCode, c.qty])).toEqual(
      full.map((c) => [c.name, c.setCode, c.qty]),
    );
  });

  it('falls back to the thumbnail path when the hover handler is absent', () => {
    const document = loadFixture('deck-grog');
    const row = document.querySelector('li[id^="deck-card-"]');
    row.removeAttribute('onmouseover');
    expect(parseCardRow(row)).toMatchObject({ setCode: 'cr02', number: '007' });
  });

  it('ignores rows without a name', () => {
    const document = loadFixture('deck-grog');
    const row = document.querySelector('li[id^="deck-card-"]');
    row.innerHTML = '<img src="images/extensions/cr02/007-ci-micro.jpg" /><span class="badge">x1</span>';
    expect(parseCardRow(row)).toBeNull();
  });
});

describe('parseDeckMeta', () => {
  it('reads the deck name and format', () => {
    const meta = parseDeckMeta(loadFixture('deck-lucy'));
    expect(meta.name).toBe('lucy');
    expect(meta.format).toContain('Legacy');
    expect(meta.deckId).toBe('test');
  });
});

describe('collectorNumberInt', () => {
  it('drops leading zeros and the trailing set size', () => {
    expect(collectorNumberInt('010')).toBe(10);
    expect(collectorNumberInt('7/211')).toBe(7);
    expect(collectorNumberInt('007/211')).toBe(7);
  });

  it('returns null when there is no number', () => {
    expect(collectorNumberInt(null)).toBeNull();
    expect(collectorNumberInt('a/211')).toBeNull();
  });
});

describe('deckIdFromUrl', () => {
  it('reads the deck id from a deck link', () => {
    expect(deckIdFromUrl('https://uvsultra.online/deck.php?deck=hskGhGHnUaSObBpxTNVCYVMEQhDfxx')).toBe(
      'hskGhGHnUaSObBpxTNVCYVMEQhDfxx',
    );
    expect(deckIdFromUrl('https://uvsultra.online/topdecks.php')).toBeNull();
  });
});
