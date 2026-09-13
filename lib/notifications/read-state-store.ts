// Per-account "mark as read" state for the mock Notification list.
// Persisted to localStorage, keyed by the signed-in account's email.
const STORAGE_KEY = "asams-notification-read-overrides";

function loadAll(): Record<string, Record<string, boolean>> {
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

function saveAll(all: Record<string, Record<string, boolean>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function loadReadOverrides(
  normalizedEmail: string,
): Record<string, boolean> {
  return loadAll()[normalizedEmail] ?? {};
}

export function setReadOverride(
  normalizedEmail: string,
  notificationId: string,
  isRead: boolean,
) {
  const all = loadAll();
  all[normalizedEmail] = { ...all[normalizedEmail], [notificationId]: isRead };
  saveAll(all);
}
