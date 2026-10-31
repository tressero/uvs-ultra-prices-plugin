/**
 * Build data/set-map.json: UVS Ultra set code -> TCGplayer group.
 *
 * Codes like `cr02` line up with TCGplayer abbreviations, but many do not
 * (`yyhdt`, `cha03gmm`, `ggs01`), so guessing is unsafe. Instead each candidate
 * group is scored by how many of the deck's card names actually appear in it.
 *
 *   node tools/build-set-map.mjs
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeName } from '../shared/text.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = '/tmp/opencode/tcgcsv';
const CATEGORY = 25; // UniVersus

async function cachedJson(url) {
  const key = url.replace(/^https:\/\/tcgcsv\.com\//, '').replace(/\//g, '_') + '.json';
  const file = join(CACHE, key);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const res = await fetch(url, {
    headers: { 'User-Agent': 'UVSUltraPrices/0.1.0 (set-map builder)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const json = await res.json();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(json));
  await new Promise((r) => setTimeout(r, 150)); // be a good neighbour
  return json;
}

/** Collect (setCode -> [card name]) from saved deck-list fixtures. */
async function cardsBySet() {
  const dir = join(ROOT, 'fixtures');
  const files = (await readdir(dir)).filter((f) => f.endsWith('-list.html'));
  const bySet = new Map();
  for (const file of files) {
    const html = await readFile(join(dir, file), 'utf8');
    const re =
      /<li id="deck-card-\d+"[^>]*onmouseover="[^"]*preview_listing_deck2\('([a-z0-9]+)',\s*'(\d+)'[\s\S]*?<\/li>/g;
    for (const m of html.matchAll(re)) {
      const setCode = m[1];
      const block = m[0].split(/<img[^>]*>/)[1] || '';
      const name = block.split(/<span class="badge/)[0].trim();
      if (!name) continue;
      if (!bySet.has(setCode)) bySet.set(setCode, new Set());
      bySet.get(setCode).add(name);
    }
  }
  return bySet;
}

const groups = (await cachedJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/groups`)).results;
const bySet = await cardsBySet();

// Load every group's products once; index by normalized name.
const catalog = [];
for (const g of groups) {
  const products = (await cachedJson(`https://tcgcsv.com/tcgplayer/${CATEGORY}/${g.groupId}/products`))
    .results;
  catalog.push({
    group: g,
    names: products.map((p) => normalizeName(p.cleanName || p.name)),
  });
  process.stdout.write('.');
}
process.stdout.write('\n');

const map = {};
for (const [setCode, names] of [...bySet].sort()) {
  const cards = [...names];
  const scored = catalog
    .map(({ group, names: groupNames }) => {
      let hits = 0;
      for (const card of cards) {
        const key = normalizeName(card);
        if (groupNames.some((n) => n === key || n.startsWith(key + ' '))) hits++;
      }
      return { groupId: group.groupId, name: group.name, abbreviation: group.abbreviation || '', hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const best = scored[0];
  if (!best) {
    map[setCode] = { groupId: null, name: null, hits: 0, cards: cards.length };
    console.log(`${setCode}: no candidate (${cards.length} cards)`);
    continue;
  }
  const runnerUp = scored[1];
  map[setCode] = {
    groupId: best.groupId,
    name: best.name,
    hits: best.hits,
    cards: cards.length,
    runnerUpHits: runnerUp?.hits ?? 0,
  };
  console.log(
    `${setCode} -> ${best.groupId} ${best.name}  ${best.hits}/${cards.length}` +
      (runnerUp ? `  (2nd: ${runnerUp.name} ${runnerUp.hits})` : ''),
  );
}

await mkdir(join(ROOT, 'data'), { recursive: true });
await writeFile(join(ROOT, 'data', 'set-map.json'), JSON.stringify(map, null, 2) + '\n');
console.log(`\nwrote data/set-map.json (${Object.keys(map).length} sets)`);
