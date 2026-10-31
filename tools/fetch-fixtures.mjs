/**
 * Snapshot live UVS Ultra pages into fixtures/ so tests never depend on the network.
 *
 *   node tools/fetch-fixtures.mjs
 *
 * Re-run only when the site markup changes; review the git diff to see what shifted.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fixtures');

const BASE = 'https://uvsultra.online/';

/** deck id -> fixture slug */
const DECKS = {
  hskGhGHnUaSObBpxTNVCYVMEQhDfxx: 'deck-lucy', // presale set: singles not on TCGplayer yet
  JpSBUGfvtOywBcSrfWNledZLFMYjlx: 'deck-jp', // 10 sets, mixed coverage
  lJFvGIfdQHmjKIcDnTTvPgZXVMwhFW: 'deck-grog', // CR02-heavy, clean hits
};

const PAGES = [
  ['topdecks.php', 'topdecks.html'],
  ['folder.php?id=1297', 'folder-decks.html'], // a folder that holds decks directly
  ['index.php', 'index.html'],
  ['card.php?id=11619', 'card-grog.html'], // Grog: a clean, released-set card
  ['showcard.php?id=11619', 'showcard-grog.html'],
];

async function get(path, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(BASE + path);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      if (i === attempts) throw err;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

/** listing_cards.php is a POST endpoint; it returns the search-result fragment. */
async function post(path, body, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      if (i === attempts) throw err;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

await mkdir(OUT, { recursive: true });

const written = [];

for (const [path, name] of PAGES) {
  await writeFile(join(OUT, name), await get(path));
  written.push(name);
}

// The search results for "Grog": three printings, all on a released set.
await writeFile(join(OUT, 'search-grog.html'), await post('listing_cards.php', 'name=Grog&page=0'));
written.push('search-grog.html');

for (const [deck, slug] of Object.entries(DECKS)) {
  await writeFile(join(OUT, `${slug}.html`), await get(`/deck.php?deck=${deck}`));
  await writeFile(join(OUT, `${slug}-list.html`), await get(`/deck_card_list.php?js&deck=${deck}`));
  written.push(`${slug}.html`, `${slug}-list.html`);
}

console.log(`wrote ${written.length} fixtures to fixtures/`);
for (const name of written) console.log('  ' + name);
