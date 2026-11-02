/**
 * Pricing service for the UVS Ultra Deck Prices extension.
 *
 *   GET  /                   what this is
 *   GET  /privacy            privacy policy (the URL on the store listing)
 *   GET  /google<id>.html    site-verification file for Search Console
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
import { normalizeMetric } from '../../shared/metrics.js';
import { error, HttpError, json, preflight, readJson, secureEquals } from './http.js';
import { groupKey, mappedGroupIds, readMeta, syncCatalog } from './sync.js';
import { homePage, privacyPage } from './pages.js';

const MAX_CARDS = 200;

/** Reject anything that is not shaped like a parsed deck row. */
function validateCards(value) {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError('cards must be a non-empty array', 400);
  if (value.length > MAX_CARDS) throw new HttpError(`at most ${MAX_CARDS} cards per request`, 413);

  return value.map((card, index) => {
    if (!card || typeof card !== 'object') throw new HttpError(`cards[${index}] must be an object`, 400);
    const { name, setCode, numberInt, qty, cardId } = card;
    if (typeof name !== 'string' || !name.trim() || name.length > 200) {
      throw new HttpError(`cards[${index}].name is required`, 400);
    }
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new HttpError(`cards[${index}].qty must be 1..99`, 400);
    }
    return {
      // Echoed back so the client can look up a card's rarity for placeholders.
      cardId: typeof cardId === 'string' && /^[A-Za-z0-9]{1,32}$/.test(cardId) ? cardId : null,
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
  const metric = normalizeMetric(body?.metric);

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
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 20);
  // Stale-set driven, not forced: a forced full sync would re-fetch the same
  // first batch forever, because the batch is chosen by stamp.
  const result = await syncCatalog(env, { force: false, limit: Math.min(Math.max(limit, 1), 24) });
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

/**
 * True for the 2am and 2pm America/New_York runs.
 *
 * Worker cron expressions are UTC and have no timezone, so wrangler declares
 * both DST offsets. This gate keeps only the invocation that lands on 2 or 14
 * Eastern; the other two fire but do no work (and make no subrequests).
 */
export function isEasternPriceWindow(date) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(date),
  );
  return hour === 2 || hour === 14;
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

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  try {
      // Human-facing pages. Static HTML, no scripts.
      if ((url.pathname === '/' || url.pathname === '/privacy') && request.method === 'GET') {
        const body =
          url.pathname === '/privacy'
            ? privacyPage(env.SITE_VERIFICATION)
            : homePage(env.SITE_VERIFICATION);
        return new Response(body, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=3600',
            'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
          },
        });
      }

      // Google Search Console verifies a domain by fetching /google<token>.html,
      // which must return exactly "google-site-verification: google<token>.html".
      // The token is the filename, so no upload or file copy is needed.
      const verification = url.pathname.match(/^\/(google[a-z0-9]{16})\.html$/i);
      if (verification && request.method === 'GET') {
        return new Response(`google-site-verification: ${verification[1]}.html`, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        });
      }

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
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return preflight();

    // HEAD must mirror GET. A URL that answers 200 to GET and 404 to HEAD looks
    // like cloaking to a crawler — which is how a verification check turns into
    // "your site might have been hacked".
    if (request.method === 'HEAD') {
      const response = await handleRequest(
        new Request(request.url, { method: 'GET', headers: request.headers }),
        env,
        ctx,
      );
      const body = await response.text();
      const headers = new Headers(response.headers);
      headers.set('content-length', String(new TextEncoder().encode(body).byteLength));
      return new Response(null, { status: response.status, headers });
    }

    return handleRequest(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    // Both DST cron expressions fire; only the 2am/2pm Eastern one works.
    if (!isEasternPriceWindow(new Date(event.scheduledTime ?? Date.now()))) return;

    // 24 sets max: each costs two subrequests and the plan allows 50 per run.
    // The 2am run takes 24, the 2pm run finishes the remaining 23.
    ctx.waitUntil(
      syncCatalog(env, { force: false, limit: 24 })
        .then((result) => {
          console.log(JSON.stringify({ message: 'cron sync', ...summarize(result) }));
        })
        .catch((err) => {
          console.error(JSON.stringify({ message: 'cron sync failed', error: String(err) }));
        }),
    );
  },
};
