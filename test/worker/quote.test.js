import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../worker/src/index.js';
import { fakeCtx, fakeKV } from '../helpers/worker.js';

const ENV = () => ({ PRICING: fakeKV(), SOURCE_BASE: 'https://example.test', CATALOG_CATEGORY: '25' });

/** Minimal CR02 group: enough for one card. */
const CR02 = {
  name: 'Critical Role: Heroes of Exandria',
  products: [
    {
      id: 1,
      name: 'Grog Strongjaw, Mighty Half-Giant',
      number: '7/211',
      mid: 1.75,
      market: 1.5,
      low: 1,
      url: 'https://www.tcgplayer.com/product/1',
    },
  ],
};

function seeded() {
  const env = ENV();
  env.PRICING = fakeKV({
    meta: JSON.stringify({
      stamp: '2026-10-30T20:06:16+0000',
      syncedAt: '2026-10-30T20:30:00.000Z',
      groups: { 24191: { name: CR02.name, count: 1 } },
      products: 1,
    }),
    'group:24191': JSON.stringify(CR02),
  });
  return env;
}

const post = (path, body, headers = {}) =>
  new Request(`https://prices.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /v1/health', () => {
  it('reports an empty catalog before the first sync', async () => {
    const response = await worker.fetch(new Request('https://prices.test/v1/health'), ENV(), fakeCtx());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, updatedAt: null, products: 0, sets: 0 });
    expect(body.missingSets.length).toBe(body.mappedSets);
  });

  it('reports what the sync stored', async () => {
    const response = await worker.fetch(new Request('https://prices.test/v1/health'), seeded(), fakeCtx());
    const body = await response.json();
    expect(body).toMatchObject({ updatedAt: '2026-10-30T20:30:00.000Z', products: 1, sets: 1 });
    expect(body.missingSets).not.toContain('24191');
  });
});

describe('POST /v1/quote', () => {
  it('prices a deck against the stored catalog', async () => {
    const response = await worker.fetch(
      post('/v1/quote', {
        cards: [{ name: 'Grog Strongjaw, Mighty Half-Giant', setCode: 'cr02', numberInt: 7, qty: 4 }],
        metric: 'market',
      }),
      seeded(),
      fakeCtx(),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items[0].match.name).toBe('Grog Strongjaw, Mighty Half-Giant');
    expect(body.items[0].line).toBe(6);
    expect(body.totals.market).toBe(6);
    expect(body.totals.mid).toBe(7);
    expect(body.totals.complete).toBe(true);
    expect(body.updatedAt).toBe('2026-10-30T20:30:00.000Z');
  });

  it('prices the mid metric and accepts an unknown metric as market', async () => {
    for (const [metric, total] of [
      ['mid', 7],
      ['market', 6],
      ['low', 4],
      ['nonsense', 6],
    ]) {
      const response = await worker.fetch(
        post('/v1/quote', {
          cards: [{ name: 'Grog Strongjaw, Mighty Half-Giant', setCode: 'cr02', numberInt: 7, qty: 4 }],
          metric,
        }),
        seeded(),
        fakeCtx(),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.totals.metric).toBe(metric === 'nonsense' ? 'market' : metric);
      expect(body.totals[body.totals.metric]).toBe(total);
    }
  });

  it('answers 503 and warms the sets it needs when nothing is synced yet', async () => {
    const env = ENV();
    const ctx = fakeCtx();
    // Warming calls out to tcgcsv; keep the test offline.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));

    const response = await worker.fetch(
      post('/v1/quote', {
        cards: [{ name: 'Grog Strongjaw, Mighty Half-Giant', setCode: 'cr02', numberInt: 7, qty: 1 }],
      }),
      env,
      ctx,
    );

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('warming-up');
    expect(ctx.pending).toHaveLength(1);
    await ctx.settle();
  });

  it('reports cards it cannot price instead of dropping them', async () => {
    const response = await worker.fetch(
      post('/v1/quote', {
        cards: [
          { name: 'Grog Strongjaw, Mighty Half-Giant', setCode: 'cr02', numberInt: 7, qty: 1 },
          { name: 'Lucy Heartfilia, Celestial Wizard', setCode: 'ft01', numberInt: 10, qty: 4 },
        ],
      }),
      seeded(),
      fakeCtx(),
    );
    const body = await response.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[1].unit).toBeNull();
    expect(body.totals.unpricedCards).toBe(1);
    expect(body.totals.unpricedQty).toBe(4);
    expect(body.totals.complete).toBe(false);
  });

  it('rejects malformed input', async () => {
    const cases = [
      [{}, 400],
      [{ cards: [] }, 400],
      [{ cards: [{ name: 'x', qty: 0 }] }, 400],
      [{ cards: [{ name: 'x', qty: 1 }], junk: true }, 200],
    ];
    for (const [body, status] of cases) {
      const response = await worker.fetch(post('/v1/quote', body), seeded(), fakeCtx());
      expect(response.status).toBe(status);
    }
  });

  it('caps the deck size', async () => {
    const cards = Array.from({ length: 201 }, (_, i) => ({ name: `card ${i}`, qty: 1 }));
    const response = await worker.fetch(post('/v1/quote', { cards }), seeded(), fakeCtx());
    expect(response.status).toBe(413);
  });
});

describe('admin routes', () => {
  it('are invisible without a matching token', async () => {
    const env = { ...ENV(), ADMIN_TOKEN: 'secret-token' };
    const missing = await worker.fetch(post('/v1/admin/sync', {}), env, fakeCtx());
    const wrong = await worker.fetch(
      post('/v1/admin/sync', {}, { authorization: 'Bearer nope' }),
      env,
      fakeCtx(),
    );
    expect(missing.status).toBe(404);
    expect(wrong.status).toBe(404);
  });

  it('are disabled entirely when no token is configured', async () => {
    const response = await worker.fetch(
      post('/v1/admin/sync', {}, { authorization: 'Bearer anything' }),
      ENV(),
      fakeCtx(),
    );
    expect(response.status).toBe(404);
  });
});

describe('human-facing pages', () => {
  it('serves a home page and a privacy policy with no scripts', async () => {
    for (const path of ['/', '/privacy']) {
      const response = await worker.fetch(new Request(`https://prices.test${path}`), ENV(), fakeCtx());
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(body).not.toMatch(/<script/i);
      expect(body.length).toBeGreaterThan(500);
    }
  });

  it('names the real pricing service and the contact in the policy', async () => {
    const response = await worker.fetch(new Request('https://prices.test/privacy'), ENV(), fakeCtx());
    const body = await response.text();
    expect(body).toContain('uvs-ultra-prices.marc-ee2.workers.dev');
    expect(body).toContain('marc@ochsner.me');
    expect(body).toContain('No remote code');
  });

  it('does not serve pages for other methods', async () => {
    const response = await worker.fetch(
      new Request('https://prices.test/privacy', { method: 'POST', body: '{}' }),
      ENV(),
      fakeCtx(),
    );
    expect(response.status).toBe(404);
  });
});

describe('site verification', () => {
  it('serves Google verification files byte for byte', async () => {
    const response = await worker.fetch(
      new Request('https://prices.test/googlee3b8506c223774f8.html'),
      ENV(),
      fakeCtx(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe(
      'google-site-verification: googlee3b8506c223774f8.html',
    );
  });

  it('does not answer other .html paths', async () => {
    const response = await worker.fetch(
      new Request('https://prices.test/anythingelse.html'),
      ENV(),
      fakeCtx(),
    );
    expect(response.status).toBe(404);
  });
});

describe('CORS', () => {
  it('answers preflight', async () => {
    const response = await worker.fetch(
      new Request('https://prices.test/v1/quote', { method: 'OPTIONS' }),
      ENV(),
      fakeCtx(),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });
});
