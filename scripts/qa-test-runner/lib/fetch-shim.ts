// lib/*/store.ts modules call fetch() with paths relative to the app's
// own origin (e.g. fetch("/api/applications")) because in the browser
// that resolves against window.location. There is no window here, so a
// bare relative path throws "Failed to parse URL". This patches global
// fetch, once, to prepend the dev server's origin to any relative URL -
// letting the exact same store functions the UI calls run unmodified
// from this Node script.
const BASE_URL = process.env.ASAMS_BASE_URL ?? "http://localhost:3000";

let installed = false;

export function installFetchShim(): void {
  if (installed) return;
  installed = true;
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/")) {
      return realFetch(BASE_URL + input, init);
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

export async function assertServerUp(): Promise<void> {
  installFetchShim();
  try {
    const res = await fetch("/api/animals");
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
  } catch (err) {
    throw new Error(
      `Cannot reach ASAMS dev server at ${BASE_URL} - is "npm run dev" running? (${(err as Error).message})`,
    );
  }
}
