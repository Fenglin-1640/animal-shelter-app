"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { formatDisplayName } from "@/lib/auth/format-name";
import type { Role } from "@/lib/roles/roles";

// Prototype auth per PRD FR-AUTH-01 / section 4.1: 6 failed attempts locks
// an account. Users (including credentials, role, status and lockout
// state) now live in the database behind /api/auth and /api/users - see
// prisma/contract.prisma - instead of the localStorage overlays this
// module used to read/write directly.
const STORAGE_KEY = "asams-session";

export interface SessionUser {
  id: string;
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
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<ChangePasswordResult>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface RawSessionUser {
  id: string;
  email: string;
  role: Role;
  status: "Active" | "Inactive";
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  signUpAt: string;
  lastLoginAt: string;
}

function toSessionUser(raw: RawSessionUser): SessionUser {
  return {
    ...raw,
    displayName: formatDisplayName(raw.title, raw.firstName, raw.lastName),
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

  const signIn = useCallback(async (rawEmail: string, password: string): Promise<SignInResult> => {
    const email = rawEmail.trim().toLowerCase();
    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();

    if (!result.ok) {
      return result;
    }

    const sessionUser = toSessionUser(result.user);
    setSession({ status: "authenticated", user: sessionUser });
    saveSession({ user: sessionUser });
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    setSession((prev) => ({ ...prev, status: "unauthenticated", user: null }));
    saveSession({ user: null });
  }, []);

  const signUp = useCallback(async (input: SignUpInput): Promise<SignUpResult> => {
    const response = await fetch("/api/auth/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return response.json();
  }, []);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!session.user) return;
      await fetch(`/api/users/${session.user.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
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
    async (currentPassword: string, newPassword: string): Promise<ChangePasswordResult> => {
      if (!session.user) {
        return { ok: false, reason: "incorrect_current_password" };
      }
      const response = await fetch(`/api/users/${session.user.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return response.json();
    },
    [session.user],
  );

  // Re-derives the session user from the database, applying the latest
  // role/status. Call after an action that may have changed the
  // signed-in user's own role/status (e.g. an Administrator transfer
  // that demotes themselves) so the shell reflects it immediately.
  const refreshCurrentUser = useCallback(async () => {
    if (!session.user) return;
    const response = await fetch(`/api/users/${session.user.id}`);
    if (!response.ok) return;
    const result = await response.json();
    if (!result.ok) return;
    const updatedUser = toSessionUser(result.user);
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
