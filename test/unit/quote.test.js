import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The content script talks to an MV3 service worker that Chrome stops after
 * ~30s idle. The first message after that regularly rejects; one lost message
 * used to mean no prices at all.
 */

function stubChrome(sendMessage) {
  globalThis.chrome = {
    runtime: { id: 'test-extension', sendMessage },
  };
}

const okQuote = { ok: true, items: [], totals: { market: 1 } };

beforeEach(() => {
  vi.resetModules();
  globalThis.__DEV__ = false;
});

afterEach(() => {
  delete globalThis.chrome;
  delete globalThis.__DEV__;
});

describe('requestQuote', () => {
  it('retries when the service worker was asleep', async () => {
    // Chrome's two typical rejections when the worker is not running yet.
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'))
      .mockRejectedValueOnce(new Error('The message port closed before a response was received.'))
      .mockResolvedValueOnce(okQuote);

    stubChrome(sendMessage);
    const { requestQuote } = await import('../../extension/src/shared/quote.js');

    const quote = await requestQuote([{ name: 'A Card', qty: 1 }], 'market');
    expect(quote).toEqual(okQuote);
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it('gives up after three attempts and reports it as retryable', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('Receiving end does not exist.'));
    stubChrome(sendMessage);
    const { requestQuote } = await import('../../extension/src/shared/quote.js');

    const quote = await requestQuote([{ name: 'A Card', qty: 1 }], 'market');
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(quote).toMatchObject({ ok: false, retryable: true, error: 'worker-unreachable' });
  });

  it('does not retry an answer from the worker', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: false, error: 'warming-up' });
    stubChrome(sendMessage);
    const { requestQuote } = await import('../../extension/src/shared/quote.js');

    const quote = await requestQuote([{ name: 'A Card', qty: 1 }], 'market');
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(quote).toMatchObject({ ok: false, retryable: false, error: 'warming-up' });
  });

  it('sends only plain card objects', async () => {
    const sendMessage = vi.fn().mockResolvedValue(okQuote);
    stubChrome(sendMessage);
    const { requestQuote } = await import('../../extension/src/shared/quote.js');

    const element = { nodeType: 1 };
    await requestQuote([{ name: 'A Card', qty: 2, element }], 'mid', { deckId: 'abc' });
    const message = sendMessage.mock.calls[0][0];
    expect(message).toMatchObject({ type: 'quote', metric: 'mid', deckId: 'abc' });
    expect(message.cards[0]).not.toHaveProperty('element');
  });
});
