import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mappedGroupIds, syncCatalog } from '../../worker/src/sync.js';
import { fakeKV } from '../helpers/worker.js';

const STAMP = '2026-10-30T20:06:16+0000';

const GROUPS = {
  results: [{ groupId: 24191, name: 'Critical Role: Heroes of Exandria', abbreviation: 'CR02' }],
};

const PRODUCTS = {
  results: [
    {
      productId: 1,
      name: 'Grog Strongjaw, Mighty Half-Giant',
      url: 'https://www.tcgplayer.com/product/1',
      extendedData: [{ name: 'Rarity', value: 'Common' }, { name: 'Number', value: '7/211' }],
    },
    {
      productId: 2,
      name: 'Grog Strongjaw, Mighty Half-Giant (Serial Numbered)',
      url: 'https://www.tcgplayer.com/product/2',
      extendedData: [{ name: 'Number', value: '7/211' }],
    },
  ],
};

const PRICES = {
  results: [
    { productId: 1, midPrice: 1.75, marketPrice: 1.5, lowPrice: 1 },
    { productId: 2, midPrice: 610, marketPrice: 620.48, lowPrice: 600 },
  ],
};

function stubSource({ fail = null } = {}) {
  const fetchMock = vi.fn(async (url) => {
    const href = String(url);
    if (fail && href.includes(fail)) return new Response('boom', { status: 500 });
    if (href.endsWith('/last-updated.txt')) return new Response(STAMP);
    if (href.includes('/groups')) return Response.json(GROUPS);
    if (href.endsWith('/products')) return Response.json(PRODUCTS);
    if (href.endsWith('/prices')) return Response.json(PRICES);
    return new Response('unexpected ' + href, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const env = (kv = fakeKV()) => ({ PRICING: kv, SOURCE_BASE: 'https://example.test', CATALOG_CATEGORY: '25' });

beforeEach(() => {
  stubSource();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mappedGroupIds', () => {
  it('deduplicates the groups the set map points at', () => {
    const ids = mappedGroupIds();
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('24191');
  });
});

describe('syncCatalog', () => {
  it('stores a trimmed group and a meta record', async () => {
    const kv = fakeKV();
    const result = await syncCatalog(env(kv), { groups: ['24191'] });

    expect(result.failures).toEqual([]);
    const group = await kv.get('group:24191', 'json');
    expect(group.name).toBe('Critical Role: Heroes of Exandria');
    expect(group.products).toHaveLength(2);
    // Descriptions and extendedData are dropped; only pricing fields survive.
    expect(Object.keys(group.products[0]).sort()).toEqual([
      'id', 'low', 'market', 'mid', 'name', 'number', 'rarity',
    ]);
    expect(group.products[0]).toMatchObject({ id: 1, number: '7/211', mid: 1.75, market: 1.5, low: 1 });

    const meta = await kv.get('meta', 'json');
    expect(meta).toMatchObject({ stamp: STAMP, products: 2 });
    expect(meta.groups['24191']).toEqual({ name: group.name, count: 2, stamp: STAMP, schema: 3 });
  });

  it('does nothing when the source has not rebuilt since the last sync', async () => {
    const kv = fakeKV();
    await syncCatalog(env(kv), { groups: ['24191'] });
    stubSource();
    const second = await syncCatalog(env(kv), { groups: ['24191'] });
    expect(second.skipped).toBe(true);
  });

  it('respects force even when the stamp is unchanged', async () => {
    const kv = fakeKV();
    await syncCatalog(env(kv), { groups: ['24191'] });
    const second = await syncCatalog(env(kv), { groups: ['24191'], force: true });
    expect(second.skipped).toBe(false);
  });

  it('keeps the previous group data when one set fails', async () => {
    const kv = fakeKV();
    await syncCatalog(env(kv), { groups: ['24191'] });
    const before = await kv.get('group:24191', 'json');

    stubSource({ fail: '/24191/products' });
    const result = await syncCatalog(env(kv), { groups: ['24191'], force: true });

    expect(result.failures).toHaveLength(1);
    expect(await kv.get('group:24191', 'json')).toEqual(before);
  });

  it('refreshes a few sets at a time and reports what is left', async () => {
    // Three groups, two per run: the free plan's 50-subrequest cap makes this
    // necessary, so each run must make progress without starting over.
    stubSource();
    const kv = fakeKV();

    const first = await syncCatalog(env(kv), { groups: ['24191', '24583', '24209'], limit: 2 });
    expect(first.groups).toHaveLength(2);
    expect(first.remaining).toBe(1);

    const second = await syncCatalog(env(kv), { groups: ['24191', '24583', '24209'], limit: 2 });
    expect(second.groups).toEqual(['24209']);
    expect(second.remaining).toBe(0);

    const third = await syncCatalog(env(kv), { groups: ['24191', '24583', '24209'], limit: 2 });
    expect(third.skipped).toBe(true);
  });

  it('sends a User-Agent, as tcgcsv requires', async () => {
    const kv = fakeKV();
    const fetchMock = stubSource();
    await syncCatalog(env(kv), { groups: ['24191'] });
    const headers = fetchMock.mock.calls.map(([, init]) => init?.headers?.['user-agent']);
    expect(headers.every((value) => typeof value === 'string' && value.length > 0)).toBe(true);
  });
});
