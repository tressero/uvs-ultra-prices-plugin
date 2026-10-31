/**
 * Serve the saved fixtures locally so the built extension can be loaded
 * against them in a real browser, with the live site's CSS still applied.
 *
 *   node tools/serve-fixtures.mjs [port]
 *
 * Routes:
 *   /deck.php?deck=grog   /deck.php?deck=jp   /deck.php?deck=lucy
 *   /topdecks.php
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const LIVE = 'https://uvsultra.online/';

const DECKS = { grog: 'deck-grog', jp: 'deck-jp', lucy: 'deck-lucy' };

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
  if (pathname === '/topdecks.php') {
    return { file: join(ROOT, 'fixtures', 'topdecks.html') };
  }
  if (pathname === '/index.php' || pathname === '/') {
    return { file: join(ROOT, 'fixtures', 'index.html') };
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
});
