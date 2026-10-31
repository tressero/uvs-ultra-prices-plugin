/**
 * Report how much of each fixture deck can be priced, and exactly which cards
 * are missing. This is the number to watch when the set map or the matcher
 * changes — and the seed of the M1 contract test.
 *
 *   node tools/report-coverage.mjs
 */
import { createRequire } from 'node:module';
import { priceDeck } from '../extension/src/shared/match.js';
import { parseDeckCards } from '../extension/src/shared/parse.js';
import { loadFixture } from '../test/helpers/fixtures.js';

const require = createRequire(import.meta.url);
const snapshot = require('../data/prices.snapshot.json');
const setMap = require('../data/set-map.json');
const catalog = { setMap, groups: snapshot.groups };
const decks = ['deck-grog', 'deck-jp', 'deck-lucy'];

let failures = 0;

for (const name of decks) {
  const cards = parseDeckCards(loadFixture(name));
  const { items, totals } = priceDeck(cards, catalog, { metric: 'market' });

  console.log(`\n${name}`);
  console.log(
    `  market ${totals.market.toFixed(2)}  low ${totals.low.toFixed(2)}  ` +
      `priced ${totals.pricedCards}/${items.length} cards, ${totals.unpricedQty}/${totals.totalCards} copies`,
  );

  const missing = items.filter((item) => item.unit == null);
  if (missing.length) {
    console.log('  missing:');
    for (const item of missing) {
      failures++;
      console.log(
        `    ${item.card.setCode}:${item.card.number}  ${item.card.name}  [${item.reason}]` +
          (item.match ? ` -> ${item.match.name}` : ''),
      );
    }
  }

  const unsure = items.filter(
    (item) => item.confidence === 'fuzzy' || item.confidence === 'number',
  );
  if (unsure.length) {
    console.log('  uncertain matches:');
    for (const item of unsure) {
      console.log(
        `    ${item.card.name}  -> ${item.match.name}  [${item.confidence}]  $${item.unit}`,
      );
    }
  }
}

console.log(`\n${failures} unpriced card rows across ${decks.length} decks`);
