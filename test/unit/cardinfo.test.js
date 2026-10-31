import { describe, expect, it } from 'vitest';
import { parseDetailCard, parseDetailCards, parseSearchCard, parseSearchCards } from '../../extension/src/shared/cardinfo.js';
import { loadFixture } from '../helpers/fixtures.js';

describe('parseSearchCards', () => {
  it('reads every result row of a saved search', () => {
    const cards = parseSearchCards(loadFixture('search-grog'));
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.name)).toEqual([
      'Grog Strongjaw, Mighty Half-Giant',
      "Soothing Grog's Rage",
      "Grog's Rage",
    ]);
  });

  it('keeps set, collector number and printed rarity for each printing', () => {
    const [first, , third] = parseSearchCards(loadFixture('search-grog'));
    expect(first).toMatchObject({
      name: 'Grog Strongjaw, Mighty Half-Giant',
      setCode: 'cr02',
      number: '007',
      numberInt: 7,
      qty: 1,
      rarity: 'Uncommon',
    });
    expect(third).toMatchObject({ setCode: 'cr02', number: '190', rarity: 'Secret Rare' });
  });

  it('falls back to the thumbnail path when the hover handler is absent', () => {
    const document = loadFixture('search-grog');
    const row = document.querySelector('.card');
    row.querySelector('[onmouseover]').removeAttribute('onmouseover');
    expect(parseSearchCard(row)).toMatchObject({ setCode: 'cr02', number: '007' });
  });

  it('ignores parts of the page that are not card rows', () => {
    const document = loadFixture('search-grog');
    const bogus = document.createElement('div');
    bogus.className = 'card';
    bogus.innerHTML = '<div class="card_infos"><div class="card_title"></div></div>';
    document.body.append(bogus);
    expect(parseSearchCards(document)).toHaveLength(3);
  });
});

describe('parseDetailCards', () => {
  it('reads the card.php fragment used by the colorbox', () => {
    const [card] = parseDetailCards(loadFixture('card-grog'));
    expect(card).toMatchObject({
      name: 'Grog Strongjaw, Mighty Half-Giant',
      setCode: 'cr02',
      number: '007',
      numberInt: 7,
      rarity: 'Uncommon',
      qty: 1,
    });
  });

  it('reads the same card on the direct showcard.php page', () => {
    const [card] = parseDetailCards(loadFixture('showcard-grog'));
    expect(card).toMatchObject({ setCode: 'cr02', number: '007', rarity: 'Uncommon' });
  });

  it('does not treat a search row as a card page', () => {
    const rows = parseDetailCards(loadFixture('search-grog'));
    expect(rows).toHaveLength(0);
  });

  it('returns null when the fragment has no heading', () => {
    const document = loadFixture('card-grog');
    document.querySelector('.card_title').remove();
    expect(parseDetailCard(document.querySelector('.card_infos'))).toBeNull();
  });
});
