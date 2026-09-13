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
import type { Role } from "@/lib/roles/roles";

// Prototype auth per PRD FR-AUTH-01 / section 4.1: lock after 6 failed
// attempts, no real database, session lives in sessionStorage only.
const LOCKOUT_THRESHOLD = 6;
const STORAGE_KEY = "asams-session";

export interface SessionUser {
  email: string;
  role: Role;
  displayName: string;
}

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; attemptsRemaining: number }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "inactive" };

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface StoredSession {
  user: SessionUser | null;
  failedAttempts: Record<string, number>;
}

interface SessionState extends StoredSession {
  status: AuthStatus;
}

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  signIn: (email: string, password: string) => SignInResult;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): StoredSession {
  if (typeof window === "undefined") return { user: null, failedAttempts: {} };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, failedAttempts: {} };
    const parsed = JSON.parse(raw) as StoredSession;
    return {
      user: parsed.user ?? null,
      failedAttempts: parsed.failedAttempts ?? {},
    };
  } catch {
    return { user: null, failedAttempts: {} };
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
    failedAttempts: {},
  });

  useEffect(() => {
    // sessionStorage only exists in the browser, so the real session state
    // can't be known during the server-rendered "loading" pass.
    const stored = loadSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of client-only sessionStorage into React state.
    setSession({
      status: stored.user ? "authenticated" : "unauthenticated",
      user: stored.user,
      failedAttempts: stored.failedAttempts,
    });
  }, []);

  const signIn = useCallback(
    (rawEmail: string, password: string): SignInResult => {
      const email = rawEmail.trim().toLowerCase();
      const account = DEMO_ACCOUNTS.find(
        (a) => a.email.toLowerCase() === email,
      );
      const currentFailures = session.failedAttempts[email] ?? 0;

      if (currentFailures >= LOCKOUT_THRESHOLD) {
        return { ok: false, reason: "locked" };
      }

      const recordFailure = (): SignInResult => {
        const nextFailures = currentFailures + 1;
        const nextAttempts = { ...session.failedAttempts, [email]: nextFailures };
        setSession((prev) => ({ ...prev, failedAttempts: nextAttempts }));
        saveSession({ user: session.user, failedAttempts: nextAttempts });
        if (nextFailures >= LOCKOUT_THRESHOLD) {
          return { ok: false, reason: "locked" };
        }
        return {
          ok: false,
          reason: "invalid",
          attemptsRemaining: LOCKOUT_THRESHOLD - nextFailures,
        };
      };

      if (!account) return recordFailure();
      if (account.status === "Inactive") return { ok: false, reason: "inactive" };
      if (account.password !== password) return recordFailure();

      const nextAttempts = { ...session.failedAttempts, [email]: 0 };
      const sessionUser: SessionUser = {
        email: account.email,
        role: account.role,
        displayName: account.displayName,
      };
      setSession({
        status: "authenticated",
        user: sessionUser,
        failedAttempts: nextAttempts,
      });
      saveSession({ user: sessionUser, failedAttempts: nextAttempts });
      return { ok: true };
    },
    [session],
  );

  const signOut = useCallback(() => {
    setSession((prev) => ({ ...prev, status: "unauthenticated", user: null }));
    saveSession({ user: null, failedAttempts: session.failedAttempts });
  }, [session.failedAttempts]);

  return (
    <AuthContext.Provider
      value={{
        status: session.status,
        user: session.user,
        signIn,
        signOut,
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
