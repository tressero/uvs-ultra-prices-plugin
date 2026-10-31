/**
 * In-memory stand-in for a Workers KV namespace, for tests.
 * Mirrors the subset the worker uses: get(key, 'json'), put(string).
 */
export function fakeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key, type) {
      if (!store.has(key)) return null;
      const value = store.get(key);
      if (type === 'json') return typeof value === 'string' ? JSON.parse(value) : value;
      return typeof value === 'string' ? value : JSON.stringify(value);
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = '' } = {}) {
      const keys = [...store.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
}

/** ExecutionContext stub: collect background work so tests can await it. */
export function fakeCtx() {
  const pending = [];
  return {
    pending,
    waitUntil(promise) {
      pending.push(promise);
    },
    passThroughOnException() {},
    async settle() {
      await Promise.allSettled(pending);
    },
  };
}
