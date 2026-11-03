import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { isEasternPriceWindow } from '../../worker/src/index.js';
import { fakeCtx, fakeKV } from '../helpers/worker.js';

const ENV = () => ({ PRICING: fakeKV(), SOURCE_BASE: 'https://example.test', CATALOG_CATEGORY: '25' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isEasternPriceWindow', () => {
  it('accepts 2am and 2pm Eastern in both DST offsets', () => {
    // Summer (EDT, UTC-4): 06:00Z and 18:00Z.
    expect(isEasternPriceWindow(new Date('2026-07-01T06:00:00Z'))).toBe(true);
    expect(isEasternPriceWindow(new Date('2026-07-01T18:00:00Z'))).toBe(true);
    // Winter (EST, UTC-5): 07:00Z and 19:00Z.
    expect(isEasternPriceWindow(new Date('2026-01-15T07:00:00Z'))).toBe(true);
    expect(isEasternPriceWindow(new Date('2026-01-15T19:00:00Z'))).toBe(true);
  });

  it('rejects the other DST offset, which lands on 1am or 3am Eastern', () => {
    expect(isEasternPriceWindow(new Date('2026-07-01T07:00:00Z'))).toBe(false);
    expect(isEasternPriceWindow(new Date('2026-07-01T19:00:00Z'))).toBe(false);
    expect(isEasternPriceWindow(new Date('2026-01-15T06:00:00Z'))).toBe(false);
    expect(isEasternPriceWindow(new Date('2026-01-15T18:00:00Z'))).toBe(false);
  });

  it('ignores other hours of the day', () => {
    expect(isEasternPriceWindow(new Date('2026-07-01T12:00:00Z'))).toBe(false);
    expect(isEasternPriceWindow(new Date('2026-07-01T00:00:00Z'))).toBe(false);
  });
});

describe('scheduled', () => {
  it('does no work or subrequests outside the 2am/2pm Eastern windows', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ctx = fakeCtx();

    // 03:00 EDT: the winter expression firing during summer.
    await worker.scheduled({ scheduledTime: Date.parse('2026-07-01T07:00:00Z') }, ENV(), ctx);

    expect(ctx.pending).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
