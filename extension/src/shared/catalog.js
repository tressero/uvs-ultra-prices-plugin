/**
 * Catalog for the offline fallback.
 *
 * The extension ships a snapshot of the TCGplayer catalog so prices still work
 * when the pricing worker is unreachable. It is ~600 KB, so it lives as its own
 * packaged file and is only read when the worker actually fails — the service
 * worker stays small.
 *
 * build.mjs writes `catalog.json` from data/set-map.json and
 * data/prices.snapshot.json. M1 replaces this with the worker's response.
 */

let pending = null;

export async function loadBundledCatalog() {
  if (pending) return pending;

  pending = (async () => {
    const url =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('catalog.json')
        : 'catalog.json';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`catalog.json ${response.status}`);
    const catalog = await response.json();
    return {
      setMap: catalog.setMap,
      groups: catalog.groups,
      updatedAt: catalog.updatedAt ?? null,
      source: catalog.source ?? null,
    };
  })();

  return pending;
}
