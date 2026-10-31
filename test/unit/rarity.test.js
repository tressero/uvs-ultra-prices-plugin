import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_VALUES,
  parseRarityFromCardPage,
  placeholderFor,
  rarityTier,
} from '../../shared/rarity.js';
import { estimateTotals, needsRarity } from '../../shared/estimate.js';

describe('placeholderFor', () => {
  it('uses the agreed values per tier', () => {
    expect(PLACEHOLDER_VALUES).toMatchObject({ common: 1, uncommon: 1, ultraRare: 15, secretRare: 30 });
    expect(placeholderFor('Common')).toBe(1);
    expect(placeholderFor('Uncommon')).toBe(1);
    expect(placeholderFor('Rare')).toBe(1);
    expect(placeholderFor('Ultra Rare')).toBe(15);
    expect(placeholderFor('Secret Rare')).toBe(30);
  });

  it('handles the treatments TCGplayer stacks onto a rarity', () => {
    expect(placeholderFor('Ultra Rare Extra Rare')).toBe(15);
    expect(placeholderFor('Extra Secret Rare')).toBe(30);
    expect(placeholderFor('Chrome Rare')).toBe(30);
    expect(placeholderFor('Common Extra Rare')).toBe(1);
    expect(placeholderFor('Starter Exclusive')).toBe(1);
  });

  it('has no opinion when there is no rarity', () => {
    expect(placeholderFor(null)).toBeNull();
    expect(placeholderFor('')).toBeNull();
    expect(placeholderFor('None')).toBeNull();
  });

  it('names the tier for tooltips', () => {
    expect(rarityTier('Secret Rare')).toBe('secretRare');
    expect(rarityTier('Ultra Rare')).toBe('ultraRare');
    expect(rarityTier('Uncommon')).toBe('uncommon');
    expect(rarityTier('Rare')).toBe('rare');
  });
});

describe('parseRarityFromCardPage', () => {
  // Trimmed from https://uvsultra.online/card.php?id=12875
  const page = `
    <div class="card_infos">
      <div class="card_title"><h1>Lucy Heartfilia, Celestial Wizard</h1></div>
      <div class="card_division cd1">
        Set 76 - Fairy Tail: All Fired Up! #10<br />
        Character<br />
        Rare<br />
        Legacy<br />
        <a href="deck_with_card.php?id=12875">List of decks with this card</a><br />
      </div>
    </div>`;

  it('reads the line after the card type', () => {
    expect(parseRarityFromCardPage(page)).toBe('Rare');
  });

  it('reads a two-word rarity', () => {
    const ultra = page.replace('Rare<br />', 'Ultra Rare<br />');
    expect(parseRarityFromCardPage(ultra)).toBe('Ultra Rare');
  });

  it('still finds a rarity when the layout changes', () => {
    const shuffled = `
      <div class="card_division cd1">
        Set 76 #10<br />
        Secret Rare<br />
        Character<br />
      </div>`;
    expect(parseRarityFromCardPage(shuffled)).toBe('Secret Rare');
  });

  it('returns null when there is nothing to read', () => {
    expect(parseRarityFromCardPage('<div>nothing</div>')).toBeNull();
    expect(parseRarityFromCardPage('')).toBeNull();
  });
});

describe('estimateTotals', () => {
  const items = [
    { card: { name: 'Priced', qty: 4 }, unit: 2, match: { rarity: 'Rare' } },
    { card: { name: 'No listing, ultra', qty: 2 }, unit: null, match: { rarity: 'Ultra Rare' } },
    { card: { name: 'No listing, no rarity', qty: 1 }, unit: null, match: null },
  ];

  it('adds placeholders and leaves the real total untouched', () => {
    const result = estimateTotals(items, { realTotal: 8 });
    expect(result.realTotal).toBe(8);
    expect(result.estimated).toBe(30); // 2 copies x $15
    expect(result.combined).toBe(38);
    expect(result.estimatedCards).toBe(1);
    expect(result.estimatedQty).toBe(2);
    expect(result.unknownCards).toBe(1);
    expect(result.unknownQty).toBe(1);
  });

  it('accepts a rarity lookup function for cards with no product', () => {
    const result = estimateTotals(items, {
      realTotal: 8,
      rarityFor: (item) =>
        item.match?.rarity ?? (item.card.name === 'No listing, no rarity' ? 'Secret Rare' : null),
    });
    expect(result.estimated).toBe(15 * 2 + 30); // ultra + secret placeholders
    expect(result.unknownCards).toBe(0);
  });

  it('is all zeros for a fully priced deck', () => {
    const result = estimateTotals([items[0]], { realTotal: 8 });
    expect(result).toMatchObject({ estimated: 0, unknownCards: 0, combined: 8 });
  });

  it('lists the cards that still need a rarity', () => {
    const withIds = items.map((item, index) => ({ ...item, card: { ...item.card, cardId: String(index) } }));
    expect(needsRarity(withIds)).toEqual(['2']);
  });
});
