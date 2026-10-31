/**
 * Pricing service for the UVS Ultra Deck Prices extension.
 *
 *   GET  /v1/health          catalog status (no auth, cheap)
 *   POST /v1/quote           { cards, metric } -> priced deck
 *   POST /v1/admin/sync      force a sync (Authorization: Bearer ADMIN_TOKEN)
 *   POST /v1/admin/warm      sync only the sets in the request (same auth)
 *
 * Held deliberately dumb: it serves JSON, never code, and it never accepts
 * more than one deck's worth of cards per request.
 */
import setMap from '../../data/set-map.json';
import { priceDeck } from '../../shared/match.js';
import { error, HttpError, json, preflight, readJson, secureEquals } from './http.js';
import { groupKey, mappedGroupIds, readMeta, syncCatalog } from './sync.js';

const MAX_CARDS = 200;

/** Reject anything that is not shaped like a parsed deck row. */
function validateCards(value) {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError('cards must be a non-empty array', 400);
  if (value.length > MAX_CARDS) throw new HttpError(`at most ${MAX_CARDS} cards per request`, 413);

  return value.map((card, index) => {
    if (!card || typeof card !== 'object') throw new HttpError(`cards[${index}] must be an object`, 400);
    const { name, setCode, numberInt, qty } = card;
    if (typeof name !== 'string' || !name.trim() || name.length > 200) {
      throw new HttpError(`cards[${index}].name is required`, 400);
    }
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new HttpError(`cards[${index}].qty must be 1..99`, 400);
    }
    return {
      name: name.trim(),
      setCode: typeof setCode === 'string' && setCode ? setCode.toLowerCase().slice(0, 16) : null,
      numberInt: Number.isInteger(numberInt) ? numberInt : null,
      qty: quantity,
    };
  });
}

async function loadGroups(env, groupIds) {
  const entries = await Promise.all(
    groupIds.map(async (groupId) => [groupId, await env.PRICING.get(groupKey(groupId), 'json')]),
  );
  return Object.fromEntries(entries.filter(([, value]) => value));
}

async function handleQuote(request, env, ctx) {
  const body = await readJson(request);
  const cards = validateCards(body?.cards);
  const metric = body?.metric === 'low' ? 'low' : 'market';

  const meta = await readMeta(env);
  const needed = [
    ...new Set(
      cards.map((card) => (card.setCode ? setMap[card.setCode]?.groupId : null)).filter(Boolean),
    ),
  ].map(String);

  if (!meta) {
    // First request ever: warm the sets this deck needs, then answer with what
    // the snapshot can give. The client retries on its next view.
    ctx.waitUntil(
      syncCatalog(env, { groups: needed }).catch((err) => {
        console.error(JSON.stringify({ message: 'warm sync failed', error: String(err) }));
      }),
    );
    return json({ ok: false, error: 'warming-up', retryAfter: 60 }, 503);
  }

  const groups = await loadGroups(env, needed);

  const missing = needed.filter((groupId) => !groups[groupId]);
  if (missing.length) {
    ctx.waitUntil(
      syncCatalog(env, { groups: missing }).catch((err) => {
        console.error(JSON.stringify({ message: 'group sync failed', error: String(err) }));
      }),
    );
  }

  const { items, totals } = priceDeck(cards, { setMap, groups }, { metric });

  return json({
    ok: true,
    items,
    totals,
    updatedAt: meta.syncedAt,
    // Present only when part of the deck's sets have not been synced yet.
    syncing: missing.length ? missing : undefined,
  });
}

async function authorized(request, env) {
  const secret = env.ADMIN_TOKEN;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return secureEquals(token, secret);
}

async function handleAdminSync(request, env) {
  if (!(await authorized(request, env))) return error('not found', 404);
  const result = await syncCatalog(env, { force: true });
  console.log(JSON.stringify({ message: 'admin sync', ...summarize(result) }));
  return json({ ok: true, ...result });
}

async function handleAdminWarm(request, env) {
  if (!(await authorized(request, env))) return error('not found', 404);
  const body = await readJson(request);
  const groupIds = [...new Set((body?.groups ?? []).map(String))].slice(0, 20);
  if (!groupIds.length) return error('groups required', 400);
  const result = await syncCatalog(env, { groups: groupIds, force: true });
  console.log(JSON.stringify({ message: 'admin warm', groups: groupIds, ...summarize(result) }));
  return json({ ok: true, ...result });
}

function summarize(result) {
  return {
    skipped: result.skipped ?? false,
    groups: Array.isArray(result.groups) ? result.groups.length : 0,
    failures: result.failures?.length ?? 0,
  };
}

async function handleHealth(env) {
  const meta = await readMeta(env);
  const mapped = mappedGroupIds();
  return json({
    ok: true,
    updatedAt: meta?.syncedAt ?? null,
    stamp: meta?.stamp ?? null,
    products: meta?.products ?? 0,
    sets: meta ? Object.keys(meta.groups ?? {}).length : 0,
    mappedSets: mapped.length,
    missingSets: meta ? mapped.filter((id) => !meta.groups?.[id]) : mapped,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return preflight();

    try {
      if (url.pathname === '/v1/health' && request.method === 'GET') return await handleHealth(env);
      if (url.pathname === '/v1/quote' && request.method === 'POST') return await handleQuote(request, env, ctx);
      if (url.pathname === '/v1/admin/sync' && request.method === 'POST') return await handleAdminSync(request, env);
      if (url.pathname === '/v1/admin/warm' && request.method === 'POST') return await handleAdminWarm(request, env);
      return error('not found', 404);
    } catch (err) {
      if (err instanceof HttpError) return error(err.message, err.status);
      console.error(
        JSON.stringify({
          message: 'unhandled error',
          path: url.pathname,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return error('internal error', 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      syncCatalog(env, { force: false })
        .then((result) => {
          console.log(JSON.stringify({ message: 'cron sync', ...summarize(result) }));
        })
        .catch((err) => {
          console.error(JSON.stringify({ message: 'cron sync failed', error: String(err) }));
        }),
    );
  },
};
