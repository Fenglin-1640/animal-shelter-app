// Shared HTTP helpers for the lib/*/store.ts modules.
//
// Most store getters read a whole collection and filter it client-side,
// and a single screen often calls several getters that need the same
// collection at once (e.g. the Animal Profile's publish and Pre-Listing
// blockers both read holds, clearances and assessments). getJson() lets
// concurrent identical GETs share one in-flight request instead of each
// opening its own.
//
// Only in-flight requests are shared - nothing is cached once a response
// arrives. send() is used for every write and starts a new generation,
// so a GET issued after a write has started never joins a request that
// began before it and could return pre-write data.

let generation = 0;
const inflight = new Map<string, Promise<unknown>>();

// Fired when an API request is answered 401 (no valid server session);
// AuthProvider (lib/auth/auth-context.tsx) listens and signs out.
export const SESSION_EXPIRED_EVENT = "asams:session-expired";

function noteUnauthorized(response: Response) {
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  noteUnauthorized(response);
  try {
    return await response.json();
  } catch (error) {
    // Non-JSON error page (e.g. a 500): report it as a failed result
    // rather than throwing, matching the { ok: false } shape the API
    // routes use for their own errors.
    if (!response.ok) return { ok: false };
    throw error;
  }
}

export async function getJson<T = Record<string, unknown>>(url: string): Promise<T> {
  const key = `${generation} ${url}`;
  let pending = inflight.get(key);
  if (!pending) {
    pending = readJson(url).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  // Each caller gets its own copy, so one caller sorting or mutating the
  // result can't affect another.
  return structuredClone(await pending) as T;
}

export async function send(url: string, init: RequestInit): Promise<Response> {
  generation++;
  inflight.clear();
  const response = await fetch(url, init);
  noteUnauthorized(response);
  return response;
}
