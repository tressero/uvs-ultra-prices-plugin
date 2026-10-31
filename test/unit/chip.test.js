// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { chipFor } from '../../extension/src/content/chip.js';

describe('chipFor estimates', () => {
  it('renders a whole-dollar estimate and says it is one', () => {
    const item = {
      card: { name: 'Lucy Heartfilia, Celestial Wizard' },
      match: null,
      unit: null,
      reason: 'set-not-mapped',
    };
    const chip = chipFor(item, 'market', { rarity: 'Ultra Rare' });
    expect(chip.textContent).toBe('$15 (Est.)');
    expect(chip.title).toContain('Estimate $15');
  });

  it('uses whole dollars for the smaller tiers too', () => {
    const item = {
      card: { name: 'Some Rare' },
      match: null,
      unit: null,
      reason: 'no-product',
    };
    expect(chipFor(item, 'mid', { rarity: 'Rare' }).textContent).toBe('$1 (Est.)');
  });
});

describe('chipFor prices', () => {
  it('shows the selected number and lists all three in the tooltip', () => {
    const item = {
      card: { name: 'Grog', qty: 1 },
      match: { id: 1, name: 'Grog', mid: 1.75, market: 1.5, low: 1 },
      unit: 1.75,
      unitSource: 'mid',
      confidence: 'exact',
    };
    const chip = chipFor(item, 'mid');
    expect(chip.textContent).toBe('$1.75');
    expect(chip.title).toContain('mid $1.75');
    expect(chip.title).toContain('market $1.50');
    expect(chip.title).toContain('low $1.00');
  });

  it('says which price it fell back to', () => {
    const item = {
      card: { name: 'Grog', qty: 1 },
      match: { id: 1, name: 'Grog', mid: null, market: 1.5, low: 1 },
      unit: 1.5,
      unitSource: 'market',
      estimated: true,
      confidence: 'exact',
    };
    expect(chipFor(item, 'mid').title).toContain('no mid price, showing market price');
  });
});
