/**
 * Sync the TCGplayer catalog through tcgcsv into KV.
 *
 * tcgcsv asks for: one sync per day, a real User-Agent, spaced requests, and
 * no calls from user-facing apps. All of that is why this runs here instead of
 * in the extension.
 *
 * KV layout:
 *   meta            -> { schema, stamp, syncedAt, groups: { [id]: { name, count, stamp } }, products }
 *   group:<groupId> -> { name, products: [{ id, name, number, rarity, mid, market, low }] }
 */
import setMap from '../../data/set-map.json';

const GROUP_PREFIX = 'group:';
const META_KEY = 'meta';
/** Bump when the stored shape changes; every group is refetched on mismatch. */
const SCHEMA = 3;
const REQUEST_GAP_MS = 150; // tcgcsv: "include a time.sleep(100ms) in your update loop"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Every TCGplayer group the set map points at. */
export function mappedGroupIds() {
  const ids = new Set();
  for (const entry of Object.values(setMap)) {
    if (entry?.groupId) ids.add(String(entry.groupId));
  }
  return [...ids];
}

export function groupKey(groupId) {
  return `${GROUP_PREFIX}${groupId}`;
}

export async function readMeta(env) {
  return env.PRICING.get(META_KEY, 'json');
}

async function fetchJson(url, userAgent) {
  const response = await fetch(url, {
    headers: { 'user-agent': userAgent, accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

/** Keep only what the quote endpoint needs; the source rows are ~10x larger. */
function buildGroup(group, products, prices) {
  const priceOf = new Map(prices.results.map((row) => [row.productId, row]));
  const rows = [];
  for (const product of products.results) {
    if (!product.name) continue;
    const extended = product.extendedData || [];
    const price = priceOf.get(product.productId);
    const number = extended.find((entry) => entry.name === 'Number');
    const rarity = extended.find((entry) => entry.name === 'Rarity');
    rows.push({
      id: product.productId,
      name: product.name,
      number: number ? number.value : null,
      // Used to pick a placeholder when the printing has no price.
      rarity: rarity ? rarity.value : null,
      mid: price?.midPrice ?? null,
      market: price?.marketPrice ?? null,
      low: price?.lowPrice ?? null,
    });
  }
  return { name: group.name ?? null, products: rows };
}

/**
 * @param env worker env (PRICING binding, SOURCE_BASE, CATALOG_CATEGORY, USER_AGENT)
 * @param options {{ groups?: string[], force?: boolean, limit?: number }}
 *
 * The free plan allows 50 subrequests per invocation, and one set costs two
 * (products + prices), so a full refresh cannot happen in one request. Each run
 * refreshes at most `limit` sets that are still on an older stamp; the next run
 * picks up the rest.
 */
export async function syncCatalog(env, options = {}) {
  const base = (env.SOURCE_BASE ?? 'https://tcgcsv.com').replace(/\/$/, '');
  const category = env.CATALOG_CATEGORY ?? '25';
  const userAgent = env.USER_AGENT ?? 'UVSUltraPrices/0.1.0';
  const requested = (options.groups ?? mappedGroupIds()).map(String);
  const limit = options.limit ?? (options.groups ? options.groups.length : 20);

  const meta = (await readMeta(env)) ?? { schema: SCHEMA, stamp: null, syncedAt: null, groups: {}, products: 0 };
  const groups = { ...meta.groups };

  let stamp = meta.stamp;
  try {
    const response = await fetch(`${base}/last-updated.txt`, { headers: { 'user-agent': userAgent } });
    if (response.ok) stamp = (await response.text()).trim();
  } catch {
    // Keep the previous stamp; a failed check is not a reason to skip.
  }

  // Only sets that are missing, stale, or stored under an older schema.
  const stale = requested.filter(
    (groupId) =>
      options.force || groups[groupId]?.stamp !== stamp || groups[groupId]?.schema !== SCHEMA,
  );
  if (!stale.length) {
    return { skipped: true, stamp, syncedAt: meta.syncedAt, groups: Object.keys(groups), remaining: 0 };
  }

  const batch = stale.slice(0, limit);
  const groupList = await fetchJson(`${base}/tcgplayer/${category}/groups`, userAgent);
  const names = new Map(groupList.results.map((group) => [String(group.groupId), group.name]));

  const failures = [];
  let products = 0;

  for (const groupId of batch) {
    try {
      const [productRows, priceRows] = await Promise.all([
        fetchJson(`${base}/tcgplayer/${category}/${groupId}/products`, userAgent),
        fetchJson(`${base}/tcgplayer/${category}/${groupId}/prices`, userAgent),
      ]);
      const built = buildGroup({ name: names.get(groupId) ?? groups[groupId]?.name ?? null }, productRows, priceRows);
      await env.PRICING.put(groupKey(groupId), JSON.stringify(built));
      groups[groupId] = { name: built.name, count: built.products.length, stamp, schema: SCHEMA };
      products += built.products.length;
      await sleep(REQUEST_GAP_MS);
    } catch (err) {
      // Keep whatever is already stored for this group.
      failures.push({ groupId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const nextMeta = {
    schema: SCHEMA,
    stamp,
    syncedAt: new Date().toISOString(),
    groups,
    products: Object.values(groups).reduce((sum, group) => sum + (group.count ?? 0), 0),
  };

  await env.PRICING.put(META_KEY, JSON.stringify(nextMeta));

  return {
    skipped: false,
    stamp,
    syncedAt: nextMeta.syncedAt,
    groups: batch,
    products,
    failures,
    remaining: stale.length - batch.length,
  };
}
