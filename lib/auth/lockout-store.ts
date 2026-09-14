// Global, persistent failed-login/lockout tracking (PRD 4.1: 6 failures
// locks an account; Administrator can unlock it). Moved out of the
// per-tab session so a lock is visible and unlockable from any session,
// which User Administration (FR-UA-02) needs.
const STORAGE_KEY = "asams-lockouts";
export const LOCKOUT_THRESHOLD = 6;

export interface LockoutState {
  failedAttempts: number;
  lockedAt?: string;
}

function loadAll(): Record<string, LockoutState> {
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

function saveAll(all: Record<string, LockoutState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getLockoutState(email: string): LockoutState {
  const normalized = email.trim().toLowerCase();
  return loadAll()[normalized] ?? { failedAttempts: 0 };
}

export function recordFailedAttempt(email: string): LockoutState {
  const normalized = email.trim().toLowerCase();
  const all = loadAll();
  const current = all[normalized] ?? { failedAttempts: 0 };
  const failedAttempts = current.failedAttempts + 1;
  const next: LockoutState = {
    failedAttempts,
    lockedAt:
      failedAttempts >= LOCKOUT_THRESHOLD
        ? (current.lockedAt ?? new Date().toISOString())
        : undefined,
  };
  all[normalized] = next;
  saveAll(all);
  return next;
}

export function resetLockout(email: string) {
  const normalized = email.trim().toLowerCase();
  const all = loadAll();
  delete all[normalized];
  saveAll(all);
}
