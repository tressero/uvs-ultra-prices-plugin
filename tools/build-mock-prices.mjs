/**
 * Build data/prices.snapshot.json from tcgcsv for every set in data/set-map.json.
 *
 * M0 prices the deck page from this snapshot so the UI can be built and tested
 * without any backend. M1 replaces it with the worker, which produces the same
 * shape from the same source.
 *
 *   node tools/build-mock-prices.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = '/tmp/opencode/tcgcsv';
const CATEGORY = 25; // UniVersus

async function cachedJson(url) {
  const key = url.replace(/^https:\/\/tcgcsv\.com\//, '').replace(/\//g, '_') + '.json';
  const file = join(CACHE, key);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const res = await fetch(url, {
    headers: { 'User-Agent': 'UVSUltraPrices/0.1.0 (snapshot builder)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const json = await res.json();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(json));
  await new Promise((r) => setTimeout(r, 150));
  return json;
}

const setMap = JSON.parse(await readFile(join(ROOT, 'data', 'set-map.json'), 'utf8'));
const groupIds = [...new Set(Object.values(setMap).map((s) => s.groupId).filter(Boolean))];

const groups = (await cachedJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/groups`)).results;
const groupName = new Map(groups.map((g) => [g.groupId, g.name]));

const snapshot = { category: CATEGORY, source: 'tcgcsv.com', groups: {} };

for (const groupId of groupIds) {
  const [products, prices] = await Promise.all([
    cachedJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/${groupId}/products`),
    cachedJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/${groupId}/prices`),
  ]);
  const priceOf = new Map(prices.results.map((p) => [p.productId, p]));

  const rows = [];
  for (const product of products.results) {
    if (!product.name) continue;
    const price = priceOf.get(product.productId);
    const numberField = (product.extendedData || []).find((e) => e.name === 'Number');
    rows.push({
      id: product.productId,
      name: product.name,
      number: numberField ? numberField.value : null, // e.g. "10/211"
      market: price?.marketPrice ?? null,
      low: price?.lowPrice ?? null,
      url: product.url,
    });
  }

  snapshot.groups[groupId] = { name: groupName.get(groupId) ?? null, products: rows };
  console.log(`${groupId} ${groupName.get(groupId)}: ${rows.length} priced of ${products.results.length}`);
}

snapshot.generatedAt = new Date().toISOString().slice(0, 10);
await mkdir(join(ROOT, 'data'), { recursive: true });
await writeFile(join(ROOT, 'data', 'prices.snapshot.json'), JSON.stringify(snapshot) + '\n');
console.log('wrote data/prices.snapshot.json');
