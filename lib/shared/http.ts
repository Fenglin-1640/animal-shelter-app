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
//
// Every request carries this tab's session token as
// "Authorization: Bearer <token>" (lib/auth/client-session.ts) - API
// routes authenticate from that header only, so each tab acts as its own
// signed-in account. Use authedFetch() for any API call that doesn't go
// through getJson()/send().

import { getSessionToken, setSessionToken, tokenIssuedAt } from "@/lib/auth/client-session";

// Must match lib/auth/server-session.ts.
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const RENEW_AFTER_SECONDS = 60 * 60;

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

function withAuth(init: RequestInit = {}): RequestInit {
  const token = getSessionToken();
  if (!token) return init;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

// Sliding session: once this tab's token is over an hour old, ask
// /api/auth/session for a renewed one (at most one renewal in flight).
let renewing: Promise<void> | null = null;
function renewIfDue() {
  const token = getSessionToken();
  if (!token || renewing) return;
  const issuedAt = tokenIssuedAt(token, SESSION_TTL_SECONDS);
  if (issuedAt === null || Date.now() / 1000 - issuedAt < RENEW_AFTER_SECONDS) return;
  renewing = fetch("/api/auth/session", withAuth())
    .then(async (response) => {
      noteUnauthorized(response);
      if (!response.ok) return;
      const result = (await response.json()) as { token?: string };
      // Only replace the token this tab still holds (not one from a
      // sign-in that happened meanwhile).
      if (result.token && getSessionToken() === token) setSessionToken(result.token);
    })
    .catch(() => {})
    .finally(() => {
      renewing = null;
    });
}

export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  renewIfDue();
  const response = await fetch(url, withAuth(init));
  noteUnauthorized(response);
  return response;
}

async function readJson(url: string): Promise<unknown> {
  renewIfDue();
  const response = await fetch(url, withAuth());
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
  // Keyed by token too, so a request made after signing in as someone
  // else in this tab never joins one made as the previous account.
  const key = `${generation} ${getSessionToken() ?? ""} ${url}`;
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
  return authedFetch(url, init);
}
