import { describe, expect, it } from 'vitest';
import { buildMassEntryUrl, massEntryLines, selectForMassEntry } from '../../shared/massentry.js';

const items = [
  { card: { name: 'Grog Strongjaw, Mighty Half-Giant', qty: 1 }, match: { id: 12345 } },
  { card: { name: "Soothing Grog's Rage", qty: 4 }, match: null },
  { card: { name: 'Grog Strongjaw, Mighty Half-Giant', qty: 2 }, match: { id: 12345 } },
];


describe('selectForMassEntry', () => {
  const deck = [
    { card: { name: 'Priced', qty: 1 }, match: { id: 1 }, unit: 2.5 },
    { card: { name: 'No price', qty: 4 }, match: null, unit: null },
    { card: { name: 'Priced too', qty: 2 }, match: { id: 2 }, unit: 0.5 },
  ];

  it('keeps only cards with a real price', () => {
    const { included, excluded } = selectForMassEntry(deck);
    expect(included.map((item) => item.card.name)).toEqual(['Priced', 'Priced too']);
    expect(excluded.map((item) => item.card.name)).toEqual(['No price']);
  });

  it('does not send a matched card that has no price', () => {
    const { included, excluded } = selectForMassEntry([
      { card: { name: 'Listed, no price', qty: 1 }, match: { id: 9 }, unit: null },
    ]);
    expect(included).toEqual([]);
    expect(excluded).toHaveLength(1);
  });

  it('builds a URL with only the priced cards', () => {
    const { included } = selectForMassEntry(deck);
    const url = new URL(buildMassEntryUrl(included));
    expect(url.searchParams.get('c')).toBe('1-1||2-2');
  });
});

describe('massEntryLines', () => {
  it('uses the TCGplayer product id for matched cards and the name otherwise', () => {
    expect(massEntryLines(items)).toEqual([
      '1-12345',
      "4 Soothing Grog's Rage",
      '2-12345',
    ]);
  });

  it('normalises whitespace and quantity', () => {
    expect(
      massEntryLines([
        { card: { name: '  Card   Name \n', qty: 0 }, match: null },
        { card: { name: 'No Quantity' }, match: null },
        { card: { name: '', qty: 1 }, match: null },
      ]),
    ).toEqual(['1 Card Name', '1 No Quantity']);
  });

  it('returns nothing for an empty deck', () => {
    expect(massEntryLines([])).toEqual([]);
  });
});

describe('buildMassEntryUrl', () => {
  it('builds a TCGplayer Mass Entry link for the whole deck', () => {
    const url = buildMassEntryUrl(items);
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://www.tcgplayer.com');
    expect(parsed.pathname).toBe('/massentry');
    expect(parsed.searchParams.get('c')).toBe("1-12345||4 Soothing Grog's Rage||2-12345");
    expect(parsed.searchParams.get('productline')).toBe('UniVersus');
  });

  it('escapes the delimiter and spaces, matching TCGplayer share links', () => {
    const url = buildMassEntryUrl(items);
    expect(url).toContain('%7C%7C');
    expect(url).toContain('%20');
    expect(url).not.toContain('+');
  });

  it('returns null when there is nothing to send', () => {
    expect(buildMassEntryUrl([])).toBeNull();
    expect(buildMassEntryUrl([{ card: { name: ' ', qty: 1 } }])).toBeNull();
  });
});
