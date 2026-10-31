/**
 * M0 catalog: a snapshot committed at build time (data/prices.snapshot.json).
 *
 * M1 replaces the two imports below with a fetch from the pricing worker. The
 * shape stays identical — { setMap, groups } — so match.js does not change.
 */
import snapshot from '../../../data/prices.snapshot.json';
import setMap from '../../../data/set-map.json';

export function loadBundledCatalog() {
  return {
    setMap,
    groups: snapshot.groups,
    updatedAt: snapshot.generatedAt ?? null,
    source: snapshot.source ?? null,
  };
}
