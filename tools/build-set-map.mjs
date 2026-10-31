/**
 * Build data/set-map.json: UVS Ultra set code -> TCGplayer group.
 *
 * Codes like `cr02` line up with TCGplayer abbreviations, but many do not
 * (`yyhdt`, `cha03gmm`, `ggs01`), so they are never guessed. For every set in
 * the site's set dropdown, one page of its card search gives the set's code
 * and 50 card names; each TCGplayer group is then scored by how many of those
 * names actually appear in it.
 *
 *   node tools/build-set-map.mjs
 *
 * Responses are cached in /tmp/opencode so re-runs cost nothing.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeName } from '../shared/text.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = '/tmp/opencode';
const CATEGORY = 25; // UniVersus
const SITE = 'https://uvsultra.online';
const GAP_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cached(path, loader) {
  if (existsSync(path)) return readFile(path, 'utf8');
  const text = await loader();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  await sleep(GAP_MS);
  return text;
}

async function cachedJson(url) {
  const path = join(CACHE, 'tcgcsv', url.replace(/^https:\/\/tcgcsv\.com\//, '').replace(/\//g, '_') + '.json');
  return JSON.parse(
    await cached(path, async () => {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'UVSUltraPrices/0.1.0 (set-map builder)' },
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response.text();
    }),
  );
}

/** [ { id, name } ] from the site's set dropdown. */
async function setOptions() {
  const html = await cached(join(CACHE, 'uvs-index.html'), async () => {
    const response = await fetch(`${SITE}/index.php`);
    if (!response.ok) throw new Error(`index.php ${response.status}`);
    return response.text();
  });
  const start = html.indexOf('name="extension[]"');
  const block = html.slice(start, html.indexOf('</select>', start));
  return [...block.matchAll(/<option value="(\d+)"[^>]*>([^<]+)<\/option>/g)].map((match) => ({
    id: match[1],
    name: match[2].trim(),
  }));
}

/** One page of the set's card search -> { code, names }. */
async function cardsFor(setId) {
  const html = await cached(join(CACHE, 'uvs-sets', `${setId}.html`), async () => {
    const body = new URLSearchParams([
      ['extension[]', setId],
      ['page', '0'],
    ]);
    const response = await fetch(`${SITE}/listing_cards.php`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
      },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`listing_cards ${setId}: ${response.status}`);
    return response.text();
  });

  const names = new Set();
  let code = null;
  const rowPattern = /preview2\('([a-z0-9]+)',\s*'(\d+)'[\s\S]*?<h1>([^<]+)<\/h1>/g;
  for (const match of html.matchAll(rowPattern)) {
    code ??= match[1];
    names.add(match[3].trim());
  }
  return { code, names: [...names] };
}

const groups = (await cachedJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/groups`)).results;

console.log(`loading ${groups.length} TCGplayer groups...`);
const catalog = [];
for (const group of groups) {
  const products = (await cachedJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/${group.groupId}/products`))
    .results;
  catalog.push({
    group,
    names: products.map((product) => normalizeName(product.cleanName || product.name)),
  });
}

const options = await setOptions();
console.log(`${options.length} sets on UVS Ultra`);

/** code -> { names:Set, sets:[{id,name}] } */
const byCode = new Map();
for (const [index, option] of options.entries()) {
  let result;
  try {
    result = await cardsFor(option.id);
  } catch (error) {
    console.warn(`  ${option.id} ${option.name}: ${error.message}`);
    continue;
  }
  if (!result.code) {
    console.warn(`  ${option.id} ${option.name}: no cards found`);
    continue;
  }
  if (!byCode.has(result.code)) byCode.set(result.code, { names: new Set(), sets: [] });
  const entry = byCode.get(result.code);
  for (const name of result.names) entry.names.add(name);
  entry.sets.push({ id: option.id, name: option.name });
  if ((index + 1) % 20 === 0) console.log(`  ${index + 1}/${options.length} sets scanned`);
}

const map = {};
let mapped = 0;

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

/** Numbers in a set or group name, so "SoulCalibur 3" is never "SoulCalibur VI". */
function numbersIn(name) {
  const found = new Set();
  for (const token of String(name ?? '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (!token) continue;
    if (/^\d+$/.test(token)) found.add(Number(token));
    else if (ROMAN[token]) found.add(ROMAN[token]);
  }
  return found;
}

function sameNumbers(a, b) {
  const left = numbersIn(a);
  const right = numbersIn(b);
  if (!left.size || !right.size) return true;
  for (const value of left) if (right.has(value)) return true;
  return false;
}

for (const [code, entry] of [...byCode].sort(([a], [b]) => a.localeCompare(b))) {
  const cards = [...entry.names];
  const scored = catalog
    .map(({ group, names: groupNames }) => {
      let hits = 0;
      for (const card of cards) {
        const key = normalizeName(card);
        if (groupNames.some((name) => name === key || name.startsWith(`${key} `))) hits++;
      }
      return { groupId: group.groupId, name: group.name, abbreviation: group.abbreviation || '', hits };
    })
    .filter((candidate) => candidate.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const best = scored[0];
  const runnerUp = scored[1];
  const setName = entry.sets[0]?.name ?? null;
  const ratio = best ? best.hits / Math.max(cards.length, 1) : 0;
  const margin = best ? best.hits - (runnerUp?.hits ?? 0) : 0;

  // Two ways to be sure. A real match covers most of a set's cards. Legacy
  // UFS sets are bundled into one TCGplayer group under different names, so
  // they score lower but still separate clearly from the noise — as long as
  // the names do not disagree about which game/number they are.
  const strong = best && ratio >= 0.5 && best.hits >= 3 && margin > 0;
  const legacy =
    best && best.hits >= 6 && margin >= 4 && sameNumbers(setName, best.name);
  const confident = Boolean(strong || legacy);

  if (!confident) {
    map[code] = {
      groupId: null,
      name: setName,
      hits: best?.hits ?? 0,
      cards: cards.length,
      reason: best ? 'low-confidence' : 'not-on-tcgplayer',
    };
    if (process.env.DEBUG_SET) {
      console.log(
        `  ${code} (${setName}): ` +
          scored.slice(0, 3).map((s) => `${s.name} ${s.hits}/${cards.length}`).join(' | '),
      );
    }
    continue;
  }

  map[code] = {
    groupId: best.groupId,
    name: best.name,
    hits: best.hits,
    cards: cards.length,
  };
  if (runnerUp && runnerUp.hits === best.hits) map[code].tie = runnerUp.name;
  mapped++;
}

await writeFile(join(ROOT, 'data', 'set-map.json'), JSON.stringify(map, null, 2) + '\n');

console.log(`\n${mapped}/${Object.keys(map).length} sets mapped to a TCGplayer group`);
const weak = Object.entries(map).filter(([, value]) => value.groupId && value.hits < 5);
if (weak.length) {
  console.log('weak matches (<5 cards):');
  for (const [code, value] of weak) console.log(`  ${code} -> ${value.groupId} ${value.name} ${value.hits}/${value.cards}`);
}
const ties = Object.entries(map).filter(([, value]) => value.tie);
if (ties.length) {
  console.log('ties:');
  for (const [code, value] of ties) console.log(`  ${code} -> ${value.name} (also ${value.tie})`);
}
const missing = Object.entries(map).filter(([, value]) => !value.groupId);
console.log(`${missing.length} sets with no TCGplayer group: ${missing.map(([code]) => code).join(', ')}`);
