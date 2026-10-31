/**
 * Serve the saved fixtures locally so the built extension can be loaded
 * against them in a real browser, with the live site's CSS still applied.
 *
 *   node tools/serve-fixtures.mjs [port]
 *
 * Routes:
 *   /deck.php?deck=grog|jp|lucy
 *   /deck_card_list.php?js&deck=<id>     (the three saved decks only)
 *   /topdecks.php     /folder.php?id=1297     /index.php
 *   POST /listing_cards.php              (search results for "Grog")
 *   /card.php?id=11619   /showcard.php?id=11619
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const LIVE = 'https://uvsultra.online/';

const DECKS = { grog: 'deck-grog', jp: 'deck-jp', lucy: 'deck-lucy' };

/** Real deck ids -> saved card-list fragments (for the list-page preview). */
const DECK_IDS = {
  lJFvGIfdQHmjKIcDnTTvPgZXVMwhFW: 'deck-grog-list',
  JpSBUGfvtOywBcSrfWNledZLFMYjlx: 'deck-jp-list',
  hskGhGHnUaSObBpxTNVCYVMEQhDfxx: 'deck-lucy-list',
};

/** Point the fixture's relative css/js/images at the live site so it looks real. */
function absolutize(html) {
  return html.replace(
    /(href|src)="(?!https?:|\/\/|#|data:|javascript:)([^"]+)"/g,
    (_match, attr, path) => `${attr}="${LIVE}${path}"`,
  );
}

function resolvePath(url) {
  const { pathname, searchParams } = url;

  if (pathname === '/deck.php') {
    const slug = searchParams.get('deck');
    const file = DECKS[slug];
    return file ? { file: join(ROOT, 'fixtures', `${file}.html`) } : null;
  }

  if (pathname === '/deck_card_list.php') {
    const id = searchParams.get('deck');
    const file = DECK_IDS[id];
    return file ? { file: join(ROOT, 'fixtures', `${file}.html`) } : { status: 404 };
  }

  if (pathname === '/topdecks.php') return { file: join(ROOT, 'fixtures', 'topdecks.html') };
  if (pathname === '/folder.php') return { file: join(ROOT, 'fixtures', 'folder-decks.html') };
  if (pathname === '/index.php' || pathname === '/') return { file: join(ROOT, 'fixtures', 'index.html') };

  // Search results: the real site POSTs the form to this endpoint.
  if (pathname === '/listing_cards.php') return { file: join(ROOT, 'fixtures', 'search-grog.html') };

  // One card page, used by both the colorbox and the direct-link page.
  if (pathname === '/card.php' && searchParams.get('id') === '11619') {
    return { file: join(ROOT, 'fixtures', 'card-grog.html') };
  }
  if (pathname === '/showcard.php' && searchParams.get('id') === '11619') {
    return { file: join(ROOT, 'fixtures', 'showcard-grog.html') };
  }

  return null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const target = resolvePath(url);

  if (!target) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
    return;
  }
  if (target.status === 404) {
    // Unknown deck in a list page: behave like the real site for a bad id.
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
    return;
  }

  try {
    const html = await readFile(target.file, 'utf8');
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(absolutize(html));
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain' });
    response.end(String(error));
  }
});

server.listen(PORT, () => {
  console.log(`fixtures on http://localhost:${PORT}`);
  for (const slug of Object.keys(DECKS)) console.log(`  /deck.php?deck=${slug}`);
  console.log('  /topdecks.php');
  console.log('  /folder.php?id=1297');
});
