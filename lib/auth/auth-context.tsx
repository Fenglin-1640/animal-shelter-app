"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import {
  generateAccountId,
  loadRegisteredAccounts,
  saveRegisteredAccounts,
  type RegisteredAccount,
} from "@/lib/auth/accounts-store";
import { formatDisplayName } from "@/lib/auth/format-name";
import { getProfileOverride, mergeProfileOverride } from "@/lib/auth/profile-store";
import {
  getLockoutState,
  recordFailedAttempt,
  resetLockout,
  LOCKOUT_THRESHOLD,
} from "@/lib/auth/lockout-store";
import { getDirectoryOverride } from "@/lib/user-administration/directory-store";
import type { Role } from "@/lib/roles/roles";

// Prototype auth per PRD FR-AUTH-01 / section 4.1: lock after 6 failed
// attempts (tracked globally in lib/auth/lockout-store.ts, not per
// session, so an Administrator can see and unlock it from any session).
const STORAGE_KEY = "asams-session";

export interface SessionUser {
  email: string;
  role: Role;
  status: "Active" | "Inactive";
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  signUpAt: string;
  lastLoginAt: string;
  displayName: string;
}

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; attemptsRemaining: number }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "inactive" };

export interface SignUpInput {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export type SignUpResult =
  | { ok: true; accountId: string }
  | { ok: false; reason: "duplicate" };

export interface UpdateProfileInput {
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "incorrect_current_password" };

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface StoredSession {
  user: SessionUser | null;
}

interface SessionState extends StoredSession {
  status: AuthStatus;
}

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  signIn: (email: string, password: string) => SignInResult;
  signOut: () => void;
  signUp: (input: SignUpInput) => SignUpResult;
  updateProfile: (input: UpdateProfileInput) => void;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => ChangePasswordResult;
  refreshCurrentUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LookupAccount {
  email: string;
  password: string;
  role: Role;
  status: "Active" | "Inactive";
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  signUpAt: string;
}

function applyOverride(
  account: LookupAccount,
  normalizedEmail: string,
): LookupAccount {
  const profileOverride = getProfileOverride(normalizedEmail);
  const directoryOverride = getDirectoryOverride(normalizedEmail);
  return {
    ...account,
    title: profileOverride?.title ?? account.title,
    firstName: profileOverride?.firstName ?? account.firstName,
    lastName: profileOverride?.lastName ?? account.lastName,
    phone: profileOverride?.phone ?? account.phone,
    password: profileOverride?.password ?? account.password,
    role: directoryOverride?.role ?? account.role,
    status: directoryOverride?.status ?? account.status,
  };
}

function findAccount(normalizedEmail: string): LookupAccount | undefined {
  const demo = DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === normalizedEmail,
  );
  if (demo) return applyOverride(demo, normalizedEmail);

  const registered = loadRegisteredAccounts().find(
    (a) => a.email.toLowerCase() === normalizedEmail,
  );
  if (!registered) return undefined;
  return applyOverride(registered, normalizedEmail);
}

function isEmailRegistered(normalizedEmail: string): boolean {
  return (
    DEMO_ACCOUNTS.some((a) => a.email.toLowerCase() === normalizedEmail) ||
    loadRegisteredAccounts().some(
      (a) => a.email.toLowerCase() === normalizedEmail,
    )
  );
}

function toSessionUser(account: LookupAccount, lastLoginAt: string): SessionUser {
  return {
    email: account.email,
    role: account.role,
    status: account.status,
    title: account.title,
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    signUpAt: account.signUpAt,
    lastLoginAt,
    displayName: formatDisplayName(
      account.title,
      account.firstName,
      account.lastName,
    ),
  };
}

function loadSession(): StoredSession {
  if (typeof window === "undefined") return { user: null };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null };
    const parsed = JSON.parse(raw) as StoredSession;
    return { user: parsed.user ?? null };
  } catch {
    return { user: null };
  }
}

function saveSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    // sessionStorage only exists in the browser, so the real session state
    // can't be known during the server-rendered "loading" pass.
    const stored = loadSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of client-only sessionStorage into React state.
    setSession({
      status: stored.user ? "authenticated" : "unauthenticated",
      user: stored.user,
    });
  }, []);

  const signIn = useCallback((rawEmail: string, password: string): SignInResult => {
    const email = rawEmail.trim().toLowerCase();

    if (getLockoutState(email).lockedAt) {
      return { ok: false, reason: "locked" };
    }

    const account = findAccount(email);

    const recordFailure = (): SignInResult => {
      const next = recordFailedAttempt(email);
      if (next.lockedAt) {
        return { ok: false, reason: "locked" };
      }
      return {
        ok: false,
        reason: "invalid",
        attemptsRemaining: LOCKOUT_THRESHOLD - next.failedAttempts,
      };
    };

    if (!account) return recordFailure();
    if (account.status === "Inactive") return { ok: false, reason: "inactive" };
    if (account.password !== password) return recordFailure();

    resetLockout(email);
    const lastLoginAt = new Date().toISOString();
    mergeProfileOverride(email, { lastLoginAt });
    const sessionUser = toSessionUser(account, lastLoginAt);
    setSession({ status: "authenticated", user: sessionUser });
    saveSession({ user: sessionUser });
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    setSession((prev) => ({ ...prev, status: "unauthenticated", user: null }));
    saveSession({ user: null });
  }, []);

  const signUp = useCallback((input: SignUpInput): SignUpResult => {
    const email = input.email.trim().toLowerCase();
    if (isEmailRegistered(email)) {
      return { ok: false, reason: "duplicate" };
    }

    const account: RegisteredAccount = {
      id: generateAccountId(),
      email: input.email.trim(),
      password: input.password,
      role: "Adopter",
      status: "Active",
      title: input.title,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      signUpAt: new Date().toISOString(),
    };
    saveRegisteredAccounts([...loadRegisteredAccounts(), account]);
    return { ok: true, accountId: account.id };
  }, []);

  const updateProfile = useCallback(
    (input: UpdateProfileInput) => {
      if (!session.user) return;
      const email = session.user.email.toLowerCase();
      mergeProfileOverride(email, {
        title: input.title,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone.trim(),
      });
      const updatedUser: SessionUser = {
        ...session.user,
        title: input.title,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone.trim(),
        displayName: formatDisplayName(
          input.title,
          input.firstName.trim(),
          input.lastName.trim(),
        ),
      };
      setSession((prev) => ({ ...prev, user: updatedUser }));
      saveSession({ user: updatedUser });
    },
    [session.user],
  );

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string): ChangePasswordResult => {
      if (!session.user) {
        return { ok: false, reason: "incorrect_current_password" };
      }
      const email = session.user.email.toLowerCase();
      const account = findAccount(email);
      if (!account || account.password !== currentPassword) {
        return { ok: false, reason: "incorrect_current_password" };
      }
      mergeProfileOverride(email, { password: newPassword });
      return { ok: true };
    },
    [session.user],
  );

  // Re-derives the session user from the account store, applying the
  // latest overrides. Call after an action that may have changed the
  // signed-in user's own role/status (e.g. an Administrator transfer
  // that demotes themselves) so the shell reflects it immediately.
  const refreshCurrentUser = useCallback(() => {
    if (!session.user) return;
    const email = session.user.email.toLowerCase();
    const account = findAccount(email);
    if (!account) return;
    const updatedUser = toSessionUser(account, session.user.lastLoginAt);
    setSession((prev) => ({ ...prev, user: updatedUser }));
    saveSession({ user: updatedUser });
  }, [session.user]);

  return (
    <AuthContext.Provider
      value={{
        status: session.status,
        user: session.user,
        signIn,
        signOut,
        signUp,
        updateProfile,
        changePassword,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
