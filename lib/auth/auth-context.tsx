"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatDisplayName } from "@/lib/auth/format-name";
import { getSessionToken, loadStoredSession, saveStoredSession } from "@/lib/auth/client-session";
import { authedFetch, SESSION_EXPIRED_EVENT } from "@/lib/shared/http";
import type { Role } from "@/lib/roles/roles";

// Prototype auth per PRD FR-AUTH-01 / section 4.1: 6 failed attempts locks
// an account. Users (including credentials, role, status and lockout
// state) now live in the database behind /api/auth and /api/users - see
// prisma/contract.prisma - instead of the localStorage overlays this
// module used to read/write directly.

// Pages reachable without signing in.
const PUBLIC_PATHS = ["/sign-in", "/sign-up"];

// How long the page-load session check may take before it counts as a
// transient failure (the stored user is kept).
const SESSION_CHECK_TIMEOUT_MS = 10000;

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

interface SessionState {
  user: SessionUser | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    // Restore this tab's session on page load (refresh, hard refresh, deep
    // link). The session lives in this tab's sessionStorage
    // (lib/auth/client-session.ts): a tab with no token - e.g. a newly
    // opened one - starts signed out without asking the server. A tab with
    // a stored user and token renders as that user straight away (no
    // extra round trip before the page and its data load) while
    // /api/auth/session, called with this tab's token, validates it in
    // the background:
    //   200 -> signed in as the account it names (picks up a role or
    //          profile change made since sign-in, and a renewed token)
    //   401 -> no valid session (expired, Inactive or Locked) -> signed out
    //   anything else (5xx, network error, timeout) is transient: keep the
    //   stored user rather than signing them out; if the session really is
    //   gone, the next API call's 401 signs them out then.
    const stored = loadStoredSession();
    const storedToken = stored.token;
    if (!storedToken) {
      saveStoredSession({ user: null });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of this tab's sessionStorage into React state.
      setSession({ status: "unauthenticated", user: null });
      return;
    }
    if (stored.user) setSession({ status: "authenticated", user: stored.user });
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);
    fetch("/api/auth/session", { signal: controller.signal, headers: { Authorization: `Bearer ${storedToken}` } })
      .then(async (response): Promise<{ user: SessionUser; token?: string } | null | "transient"> => {
        if (response.status === 401) return null;
        if (!response.ok) return "transient";
        const result = (await response.json()) as { ok?: boolean; user?: RawSessionUser; token?: string };
        return result.ok && result.user ? { user: toSessionUser(result.user), token: result.token } : "transient";
      })
      .catch((): "transient" => "transient")
      .then((outcome) => {
        clearTimeout(timeout);
        // Ignore the result if this tab has signed out or in since.
        if (cancelled || getSessionToken() !== storedToken) return;
        const user = outcome === "transient" ? stored.user : outcome?.user ?? null;
        const token = outcome !== "transient" && outcome?.token ? outcome.token : storedToken;
        saveStoredSession({ user, token });
        setSession(user ? { status: "authenticated", user } : { status: "unauthenticated", user: null });
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // Signed out on any page other than Sign In / Sign Up -> go to Sign In.
  // Done here because AuthProvider is always mounted; most screens render
  // nothing until a user exists, so AppShell's own redirect never mounts
  // for them.
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (session.status === "unauthenticated" && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/sign-in");
    }
  }, [session.status, pathname, router]);

  // Any API request answered 401 means the server session is gone (expired,
  // signed out elsewhere, account deactivated) - sign out here too, which
  // sends the user back to Sign In.
  useEffect(() => {
    const handleExpired = () => {
      saveStoredSession({ user: null });
      setSession({ status: "unauthenticated", user: null });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
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

    // Store this tab's token before re-rendering, so the first requests of
    // the signed-in screens already carry it.
    const sessionUser = toSessionUser(result.user);
    saveStoredSession({ user: sessionUser, token: result.token });
    setSession({ status: "authenticated", user: sessionUser });
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    setSession((prev) => ({ ...prev, status: "unauthenticated", user: null }));
    // Forget this tab's token - other tabs keep their own sessions.
    saveStoredSession({ user: null });
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
      await authedFetch(`/api/users/${session.user.id}/profile`, {
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
      saveStoredSession({ user: updatedUser, token: getSessionToken() });
    },
    [session.user],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<ChangePasswordResult> => {
      if (!session.user) {
        return { ok: false, reason: "incorrect_current_password" };
      }
      const response = await authedFetch(`/api/users/${session.user.id}/change-password`, {
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
    const response = await authedFetch(`/api/users/${session.user.id}`);
    if (!response.ok) return;
    const result = await response.json();
    if (!result.ok) return;
    const updatedUser = toSessionUser(result.user);
    setSession((prev) => ({ ...prev, user: updatedUser }));
    saveStoredSession({ user: updatedUser, token: getSessionToken() });
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
