/**
 * Price a sample of real decks and report what matched.
 *
 *   node tools/coverage-sweep.mjs [--decks=60]
 *
 * Decks come from topdecks.php, a few leaf folders and a user page, so the
 * sample spans sets and eras rather than the three decks used as fixtures.
 * Uses the committed snapshot (same matcher, same data as the worker), so a
 * run costs no worker or TCGplayer requests.
 *
 * Writes /tmp/opencode/coverage-sweep.json and prints a summary.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { baseName, normalizeName } from '../shared/text.js';
import { priceDeck } from '../shared/match.js';
import { parseDeckCards } from '../extension/src/shared/parse.js';
import { JSDOM } from 'jsdom';

const SITE = 'https://uvsultra.online';
const GAP_MS = 250;
const OUT = '/tmp/opencode/coverage-sweep.json';

const limitArg = process.argv.find((arg) => arg.startsWith('--decks='));
const MAX_DECKS = limitArg ? Number(limitArg.split('=')[1]) : 60;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const catalog = {
  setMap: readJson('../data/set-map.json'),
  groups: readJson('../data/prices.snapshot.json').groups,
};

async function get(path) {
  const response = await fetch(SITE + path, {
    headers: { 'user-agent': 'UVSUltraPrices/0.1.0 (coverage sweep)' },
  });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.text();
}

/** Deck ids in page order, deduped. */
function deckIds(html) {
  const ids = [];
  const seen = new Set();
  for (const match of html.matchAll(/deck\.php\?deck=([A-Za-z0-9]+)/g)) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      ids.push(match[1]);
    }
  }
  return ids;
}

console.log('collecting deck ids...');
const sources = [
  ['topdecks', '/topdecks.php'],
  ['folder 1297', '/folder.php?id=1297'],
  ['folder 1298', '/folder.php?id=1298'],
  ['folder 5349 (subfolders)', '/folder.php?id=5349'],
  ['user 2293', '/user.php?id=2293'],
];

const ids = [];
const seen = new Set();
for (const [label, path] of sources) {
  try {
    const found = deckIds(await get(path));
    let added = 0;
    for (const id of found) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      added++;
      if (ids.length >= MAX_DECKS) break;
    }
    console.log(`  ${label}: ${found.length} decks, ${added} new`);
    await sleep(GAP_MS);
  } catch (error) {
    console.warn(`  ${label}: ${error.message}`);
  }
  if (ids.length >= MAX_DECKS) break;
}

const decks = [];
const unpriced = new Map(); // `${setCode}|${reason}` -> { setCode, reason, cards, copies, examples }
const uncertain = [];
let totCards = 0;
let totCopies = 0;
let totPricedCopies = 0;
let totMarket = 0;

for (const [index, deckId] of ids.entries()) {
  let html;
  try {
    html = await get(`/deck_card_list.php?js&deck=${deckId}`);
  } catch (error) {
    console.warn(`  deck ${deckId}: ${error.message}`);
    continue;
  }

  const doc = new JSDOM(html).window.document;
  const cards = parseDeckCards(doc);
  if (!cards.length) continue;

  const { items, totals } = priceDeck(cards, catalog);
  const name = doc.querySelector('#name')?.textContent?.trim() ?? null;

  decks.push({
    deckId,
    cards: items.length,
    copies: totals.totalCards,
    market: totals.market,
    pricedCards: totals.pricedCards,
    coverage: Number(totals.coverage.toFixed(3)),
    sets: [...new Set(cards.map((card) => card.setCode))].join(','),
  });

  totCards += items.length;
  totCopies += totals.totalCards;
  totPricedCopies += totals.totalCards - totals.unpricedQty;
  totMarket += totals.market;

  for (const item of items) {
    if (item.unit == null) {
      const key = `${item.card.setCode}|${item.reason}`;
      const entry = unpriced.get(key) ?? {
        setCode: item.card.setCode,
        reason: item.reason,
        cards: 0,
        copies: 0,
        examples: [],
      };
      entry.cards++;
      entry.copies += item.card.qty;
      if (entry.examples.length < 3) entry.examples.push(item.card.name);
      unpriced.set(key, entry);
      continue;
    }

    const sameName = baseName(item.card.name) === baseName(item.match.name);
    if (!sameName && item.unit > 5) {
      uncertain.push({
        deckId,
        setCode: item.card.setCode,
        card: item.card.name,
        match: item.match.name,
        confidence: item.confidence,
        unit: item.unit,
      });
    }
  }

  if ((index + 1) % 10 === 0) console.log(`  priced ${index + 1}/${ids.length} decks`);
  await sleep(GAP_MS);
}

const summary = {
  generatedAt: new Date().toISOString(),
  decks: decks.length,
  uniqueCards: totCards,
  copies: totCopies,
  pricedCopies: totPricedCopies,
  coverageByCopies: Number((totPricedCopies / Math.max(totCopies, 1)).toFixed(3)),
  marketValuePriced: Number(totMarket.toFixed(2)),
  unpriced: [...unpriced.values()].sort((a, b) => b.copies - a.copies),
  uncertain: uncertain.sort((a, b) => b.unit - a.unit).slice(0, 40),
  worstDecks: [...decks].sort((a, b) => a.coverage - b.coverage).slice(0, 10),
  bestDecks: [...decks].sort((a, b) => b.coverage - a.coverage).slice(0, 5),
};

writeFileSync(OUT, JSON.stringify({ summary, decks }, null, 2));

console.log(`\n${summary.decks} decks, ${summary.uniqueCards} unique cards, ${summary.copies} copies`);
console.log(
  `coverage by copies: ${(summary.coverageByCopies * 100).toFixed(1)}%  ` +
    `(priced value ${summary.marketValuePriced.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`,
);
console.log(`\nunpriced by set (copies):`);
for (const entry of summary.unpriced.slice(0, 15)) {
  console.log(
    `  ${String(entry.setCode ?? '?').padEnd(14)} ${String(entry.reason).padEnd(16)} ` +
      `${String(entry.copies).padStart(4)} copies  ${entry.examples.join(' | ').slice(0, 70)}`,
  );
}
console.log(`\nuncertain matches worth a look:`);
for (const row of summary.uncertain.slice(0, 12)) {
  console.log(`  $${row.unit.toFixed(2).padStart(8)}  ${row.card}  ->  ${row.match}  [${row.confidence}]`);
}
console.log(`\nworst decks:`);
for (const row of summary.worstDecks) {
  console.log(`  ${row.deckId}  ${(row.coverage * 100).toFixed(0).padStart(3)}%  ${row.sets}  ${row.cards} cards`);
}
console.log(`\nwrote ${OUT}`);
