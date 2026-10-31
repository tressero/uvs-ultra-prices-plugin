import { describe, expect, it } from 'vitest';
import { METRICS, normalizeMetric, unitPrice } from '../../shared/metrics.js';
import { priceDeck } from '../../shared/match.js';

describe('normalizeMetric', () => {
  it('accepts the three price points and falls back to market', () => {
    for (const metric of METRICS) expect(normalizeMetric(metric)).toBe(metric);
    expect(normalizeMetric('current')).toBe('market');
    expect(normalizeMetric(undefined)).toBe('market');
  });
});

describe('unitPrice', () => {
  it('uses each field directly when all three exist', () => {
    const match = { mid: 10, market: 8, low: 6 };
    expect(unitPrice(match, 'mid')).toEqual({ unit: 10, source: 'mid' });
    expect(unitPrice(match, 'market')).toEqual({ unit: 8, source: 'market' });
    expect(unitPrice(match, 'low')).toEqual({ unit: 6, source: 'low' });
  });

  it('falls back so a card with one price still has all three metrics', () => {
    expect(unitPrice({ market: 4 }, 'mid')).toEqual({ unit: 4, source: 'market' });
    expect(unitPrice({ low: 2 }, 'mid')).toEqual({ unit: 2, source: 'low' });
    expect(unitPrice({ low: 2 }, 'market')).toEqual({ unit: 2, source: 'low' });
    expect(unitPrice({ mid: 5 }, 'low')).toEqual({ unit: 5, source: 'mid' });
  });

  it('ignores zero, negative and missing prices', () => {
    expect(unitPrice({ mid: 0, market: -1, low: null }, 'mid')).toEqual({ unit: null, source: null });
    expect(unitPrice(null, 'market')).toEqual({ unit: null, source: null });
  });
});

describe('priceDeck metrics', () => {
  const catalog = {
    setMap: { test: { groupId: 1 } },
    groups: {
      1: {
        products: [
          { id: 1, name: 'A Card', number: '1/10', mid: 10, market: 8, low: 6 },
          { id: 2, name: 'Only Low', number: '2/10', low: 3 },
        ],
      },
    },
  };
  const cards = [
    { name: 'A Card', setCode: 'test', numberInt: 1, qty: 2 },
    { name: 'Only Low', setCode: 'test', numberInt: 2, qty: 1 },
  ];

  it('totals every metric, including fallbacks', () => {
    const { totals } = priceDeck(cards, catalog);
    expect(totals.metric).toBe('market');
    expect(totals.mid).toBe(23); // 10*2 + low fallback 3
    expect(totals.market).toBe(19); // 8*2 + low fallback 3
    expect(totals.low).toBe(15); // 6*2 + 3
  });

  it('marks a fallback as estimated for the selected metric', () => {
    const { items, totals } = priceDeck(cards, catalog, { metric: 'mid' });
    expect(items[1].unit).toBe(3);
    expect(items[1].unitSource).toBe('low');
    expect(items[1].estimated).toBe(true);
    expect(totals.estimatedCards).toBe(1);
  });

  it('honours an explicit metric', () => {
    const { items, totals } = priceDeck(cards, catalog, { metric: 'low' });
    expect(totals.metric).toBe('low');
    expect(items[0].unit).toBe(6);
    expect(totals.low).toBe(15);
  });
});
