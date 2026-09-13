// Registered (Sign Up) accounts, kept separate from the static PRD demo
// accounts. Persisted to localStorage (not sessionStorage) so a newly
// created account can still sign in after the tab/session is closed.
const STORAGE_KEY = "asams-registered-accounts";

export interface RegisteredAccount {
  id: string;
  email: string;
  password: string;
  role: "Adopter";
  status: "Active";
  displayName: string;
  phone: string;
  signUpAt: string;
}

export function loadRegisteredAccounts(): RegisteredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RegisteredAccount[]) : [];
  } catch {
    return [];
  }
}

export function saveRegisteredAccounts(accounts: RegisteredAccount[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function generateAccountId(): string {
  return `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
