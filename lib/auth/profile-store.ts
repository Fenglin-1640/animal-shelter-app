// Per-account profile edits and login history, layered on top of the
// static DEMO_ACCOUNTS and the Sign Up-created RegisteredAccounts.
// Persisted to localStorage since there is no backend, keyed by the
// account's (stable, non-editable) email address.
const STORAGE_KEY = "asams-profile-overrides";

export interface ProfileOverride {
  title?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
  lastLoginAt?: string;
}

function loadOverrides(): Record<string, ProfileOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, ProfileOverride>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getProfileOverride(
  normalizedEmail: string,
): ProfileOverride | undefined {
  return loadOverrides()[normalizedEmail];
}

export function mergeProfileOverride(
  normalizedEmail: string,
  patch: ProfileOverride,
) {
  const overrides = loadOverrides();
  overrides[normalizedEmail] = { ...overrides[normalizedEmail], ...patch };
  saveOverrides(overrides);
}
