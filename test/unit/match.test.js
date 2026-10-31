import { describe, expect, it } from 'vitest';
import { baseName, editDistance, namesMatch, normalizeName, stripVariants } from '../../extension/src/shared/text.js';
import { CONFIDENCE, REASON, priceDeck, resolveCard } from '../../extension/src/shared/match.js';
import { loadBundledCatalog } from '../../extension/src/shared/catalog.js';
import { parseDeckCards } from '../../extension/src/shared/parse.js';
import { loadFixture } from '../helpers/fixtures.js';

const catalog = loadBundledCatalog();

describe('name normalization', () => {
  it('reduces TCGplayer clean names and UVS names to the same key', () => {
    expect(normalizeName('Grog Strongjaw, Mighty Half-Giant')).toBe(
      normalizeName('Grog Strongjaw Mighty Half Giant'),
    );
  });

  it('strips variant suffixes, including stacked ones', () => {
    expect(baseName('Grog Strongjaw, Mighty Half-Giant (Serial Numbered)')).toBe(
      'grog strongjaw mighty half giant',
    );
    expect(baseName('Grog Strongjaw (Alternate Art) (Foil)')).toBe('grog strongjaw');
  });

  it('matches a card to its variant printings', () => {
    expect(namesMatch('Grog Strongjaw, Mighty Half-Giant', 'Grog Strongjaw, Mighty Half-Giant (Alternate Art)')).toBe(true);
    expect(namesMatch('Grog Strongjaw, Mighty Half-Giant', 'Beauregard Lionett, Expositor')).toBe(false);
  });

  it('measures edit distance with an early exit', () => {
    expect(editDistance('lucy heartfilia', 'lucy heartfili')).toBe(1);
    expect(editDistance('abc', 'a very long name indeed')).toBeGreaterThan(2);
  });
});

describe('resolveCard', () => {
  it('picks the base printing, not the serial numbered one', () => {
    const card = { name: 'Grog Strongjaw, Mighty Half-Giant', setCode: 'cr02', numberInt: 7 };
    const { match, confidence } = resolveCard(card, catalog);
    expect(confidence).toBe(CONFIDENCE.CONFIRMED);
    expect(match.name).toBe('Grog Strongjaw, Mighty Half-Giant');
    // The serial numbered printing of the same card is hundreds of dollars.
    expect(match.market).toBeLessThan(50);
  });

  it('reports a set with no TCGplayer group instead of guessing', () => {
    const card = { name: 'Lucy Heartfilia, Celestial Wizard', setCode: 'ft01', numberInt: 10 };
    expect(resolveCard(card, catalog)).toMatchObject({
      match: null,
      reason: REASON.SET_NOT_MAPPED,
    });
  });

  it('falls back to the collector number when the name changed', () => {
    const card = { name: 'A Totally Renamed Card', setCode: 'cr02', numberInt: 7 };
    const { match, confidence } = resolveCard(card, catalog);
    expect(confidence).toBe(CONFIDENCE.NUMBER);
    expect(match.number).toBe('7/211');
  });

  it('treats a near miss at the same collector number as a confirmation', () => {
    const card = { name: 'Grog Strongjaw, Mighty Half-Gian', setCode: 'cr02', numberInt: 7 };
    const { confidence } = resolveCard(card, catalog);
    expect(confidence).toBe(CONFIDENCE.CONFIRMED);
  });

  it('accepts a near miss on spelling alone but flags it', () => {
    const card = { name: 'Grog Strongjaw, Mighty Half-Gian', setCode: 'cr02', numberInt: 999 };
    const { confidence, match } = resolveCard(card, catalog);
    expect(confidence).toBe(CONFIDENCE.FUZZY);
    expect(match.name).toContain('Grog Strongjaw');
  });

  it('returns no-product when nothing in the set resembles the card', () => {
    const card = { name: 'Zzzz Completely Unrelated Card Zzzz', setCode: 'cr02', numberInt: 999 };
    expect(resolveCard(card, catalog)).toMatchObject({ reason: REASON.NO_PRODUCT });
  });
});

describe('priceDeck', () => {
  const cards = parseDeckCards(loadFixture('deck-grog'));

  it('totals exactly the chips it renders', () => {
    const { items, totals } = priceDeck(cards, catalog);
    const sum = items.reduce((acc, item) => acc + (item.line ?? 0), 0);
    expect(totals.market).toBeCloseTo(sum, 2);
    expect(totals.pricedCards).toBe(items.filter((i) => i.unit != null).length);
  });

  it('never counts an unpriced card as $0', () => {
    const { items, totals } = priceDeck(cards, catalog);
    expect(totals.unpricedCards).toBeGreaterThan(0);
    for (const item of items.filter((i) => i.unit == null)) {
      expect(item.line).toBeNull();
    }
    expect(totals.complete).toBe(false);
  });

  it('multiplies by quantity', () => {
    const card = { name: 'Grog Strongjaw, Mighty Half-Giant', setCode: 'cr02', numberInt: 7, qty: 4 };
    const { items } = priceDeck([card], catalog);
    expect(items[0].line).toBeCloseTo(items[0].unit * 4, 2);
  });

  it('switches metric without losing cards that lack one price', () => {
    const market = priceDeck(cards, catalog, { metric: 'market' });
    const low = priceDeck(cards, catalog, { metric: 'low' });
    expect(low.totals.metric).toBe('low');
    expect(low.totals.low).not.toBeCloseTo(market.totals.market, 2);
    expect(low.totals.pricedCards).toBe(market.totals.pricedCards);
  });

  it('prices a presale deck as empty rather than free', () => {
    const lucy = parseDeckCards(loadFixture('deck-lucy'));
    const { totals } = priceDeck(lucy, catalog);
    expect(totals.pricedCards).toBeLessThan(lucy.length);
    expect(totals.market).toBeGreaterThan(0); // some cards come from released sets
    expect(totals.complete).toBe(false);
  });
});
