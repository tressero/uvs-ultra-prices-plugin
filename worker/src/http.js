/** Tiny HTTP helpers shared by the routes. */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Prices change once a day at most; let clients cache the answer.
      'cache-control': 'public, max-age=300',
      ...CORS,
    },
  });
}

export function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Read a JSON body with a hard size cap, so nobody can stream us a fridge. */
export async function readJson(request, maxBytes = 64 * 1024) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new HttpError('body too large', 413);
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError('body too large', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError('invalid json', 400);
  }
}

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Constant-time-ish string compare. Hashing first avoids leaking the length,
 * and the XOR loop keeps the compare independent of where they differ.
 * `crypto.subtle.timingSafeEqual` is Cloudflare-only, so this stays portable
 * enough to unit test in Node.
 */
export async function secureEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
