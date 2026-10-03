// lib/*/store.ts modules call fetch() with paths relative to the app's
// own origin (e.g. fetch("/api/applications")) because in the browser
// that resolves against window.location. There is no window here, so a
// bare relative path throws "Failed to parse URL". This patches global
// fetch, once, to prepend the dev server's origin to any relative URL -
// letting the exact same store functions the UI calls run unmodified
// from this Node script.
//
// The API routes also require a signed-in session (an httpOnly cookie set
// by Sign In) with a role allowed to make the call. actAs() signs in as
// the given account and every following request carries that account's
// session cookie - call it wherever the acting role changes, just as a
// different user would be signed in for that step in the browser.
const BASE_URL = process.env.ASAMS_BASE_URL ?? "http://localhost:3000";
const DEMO_PASSWORD = "Demo123!";

let installed = false;
let realFetch: typeof fetch;
let currentCookie: string | null = null;
const cookiesByEmail = new Map<string, string>();

export function installFetchShim(): void {
  if (installed) return;
  installed = true;
  realFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/")) {
      const headers = new Headers(init?.headers);
      if (currentCookie && !headers.has("cookie")) headers.set("cookie", currentCookie);
      return realFetch(BASE_URL + input, { ...init, headers });
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

// Signs in as `email` (demo accounts share Demo123!; pass the password
// for any other account) and makes it the acting user for subsequent
// requests. Sessions are cached per account.
export async function actAs(email: string, password: string = DEMO_PASSWORD): Promise<void> {
  installFetchShim();
  const key = email.trim().toLowerCase();
  const cached = cookiesByEmail.get(key);
  if (cached) {
    currentCookie = cached;
    return;
  }
  const response = await realFetch(`${BASE_URL}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: key, password }),
  });
  const result = await response.json();
  const setCookie = response.headers.get("set-cookie");
  if (!result.ok || !setCookie) throw new Error(`Sign in as ${key} failed: ${result.reason ?? "no session cookie"}`);
  currentCookie = setCookie.split(";")[0];
  cookiesByEmail.set(key, currentCookie);
}

export async function assertServerUp(): Promise<void> {
  installFetchShim();
  try {
    const res = await realFetch(`${BASE_URL}/sign-in`);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
  } catch (err) {
    throw new Error(
      `Cannot reach ASAMS dev server at ${BASE_URL} - is "npm run dev" running? (${(err as Error).message})`,
    );
  }
}
