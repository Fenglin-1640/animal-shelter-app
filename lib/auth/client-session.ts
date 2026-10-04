import type { SessionUser } from "@/lib/auth/auth-context";

// This tab's sign-in: the user the UI shows and the signed session token
// that authorises its API requests (lib/auth/server-session.ts). Kept in
// sessionStorage, which belongs to one tab: it survives a refresh, ends
// when the tab closes, and a newly opened tab starts signed out - so
// different tabs can be signed in as different accounts at the same time,
// and signing in or out in one tab never touches another. The password is
// never stored.
const STORAGE_KEY = "asams-session";

export interface StoredSession {
  user: SessionUser | null;
  token?: string | null;
}

export function loadStoredSession(): StoredSession {
  if (typeof window === "undefined") return { user: null };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null };
    const parsed = JSON.parse(raw) as StoredSession;
    return { user: parsed.user ?? null, token: parsed.token ?? null };
  } catch {
    return { user: null };
  }
}

export function saveStoredSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user: session.user, token: session.user ? (session.token ?? null) : null }));
}

export function getSessionToken(): string | null {
  return loadStoredSession().token ?? null;
}

export function setSessionToken(token: string) {
  const current = loadStoredSession();
  if (current.user) saveStoredSession({ ...current, token });
}

// When the token was issued (seconds), read from its unsigned payload
// "<userId>.<expiresAt>.<signature>" - only used to decide when to ask for
// renewal; the server verifies the signature.
export function tokenIssuedAt(token: string, ttlSeconds: number): number | null {
  const parts = token.split(".");
  const expiresAt = Number(parts[parts.length - 2]);
  return Number.isFinite(expiresAt) ? expiresAt - ttlSeconds : null;
}
