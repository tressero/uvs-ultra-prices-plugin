import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/** Load a saved fixture as a Document. Tests never touch the network. */
export function loadFixture(name) {
  const html = readFileSync(new URL(`../../fixtures/${name}.html`, import.meta.url), 'utf8');
  return new JSDOM(html, { url: 'https://uvsultra.online/deck.php?deck=test' }).window.document;
}

export function loadFixtureHtml(name) {
  return readFileSync(new URL(`../../fixtures/${name}.html`, import.meta.url), 'utf8');
}
