import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { formatDisplayName } from "@/lib/auth/format-name";
import { db } from "@/lib/db/client";
import type { Role } from "@/lib/roles/roles";

// Server-verified sign-in session for the API routes. Sign In sets an
// httpOnly cookie holding the account id and an expiry, signed with
// HMAC-SHA256; every API request verifies it and re-reads the account,
// so a role change or deactivation by an Administrator applies to the
// very next request. (The browser's sessionStorage copy of the user
// still drives the UI - lib/auth/auth-context.tsx - but grants nothing
// on its own.)

export const SESSION_COOKIE = "asams_session";
// Sliding session: it ends after this long without any API activity, and
// is re-issued (at most once an hour) while the user keeps using the app,
// so an active user is never cut off mid-session by a fixed expiry.
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const RENEW_AFTER_SECONDS = 60 * 60;

export interface ApiUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
}

// SESSION_SECRET when set; otherwise a key derived from DATABASE_URL,
// which is already a server-only secret in every environment this app
// runs in, so sessions work without extra configuration. Rotating either
// signs everyone out.
function secret(): Buffer {
  const configured = process.env.SESSION_SECRET;
  if (configured) return Buffer.from(configured);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("SESSION_SECRET or DATABASE_URL must be set");
  return createHash("sha256").update(`asams-session:${databaseUrl}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = `${userId}.${Math.floor(now / 1000) + SESSION_TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string | undefined): { userId: string; expiresAt: number } | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(token.slice(lastDot + 1));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const expiryDot = payload.lastIndexOf(".");
  const userId = payload.slice(0, expiryDot);
  const expiresAt = Number(payload.slice(expiryDot + 1));
  if (!userId || !Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return null;
  return { userId, expiresAt };
}

function sessionCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: SESSION_TTL_SECONDS };
}

export function setSessionCookie(response: NextResponse, request: Request, userId: string) {
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId), sessionCookieOptions(new URL(request.url).protocol === "https:"));
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

// The signed-in account row for this request, or null when there is no
// valid session or the account is no longer Active (or is locked). Renews
// the session cookie when it was issued more than RENEW_AFTER_SECONDS ago.
async function getSessionAccount() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const account = await db.orm.User.where({ id: session.userId }).first();
  if (!account || account.status !== "Active" || account.lockedAt) return null;
  const issuedAt = session.expiresAt - SESSION_TTL_SECONDS;
  if (Date.now() / 1000 - issuedAt > RENEW_AFTER_SECONDS) {
    const secure = (await headers()).get("x-forwarded-proto") === "https";
    cookieStore.set(SESSION_COOKIE, createSessionToken(account.id), sessionCookieOptions(secure));
  }
  return account;
}

// The signed-in user as the browser keeps it (the same shape Sign In
// returns), for restoring a session on page load.
export async function getSessionUser() {
  const account = await getSessionAccount();
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    status: account.status,
    title: account.title,
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    signUpAt: account.signUpAt,
    lastLoginAt: account.lastLoginAt ?? null,
  };
}

export async function getApiUser(): Promise<ApiUser | null> {
  const account = await getSessionAccount();
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    role: account.role as Role,
    displayName: formatDisplayName(account.title, account.firstName, account.lastName),
  };
}

export function unauthorized() {
  return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
}

// Route guard: returns the signed-in user when their role is allowed,
// otherwise the 401/403 response to send back.
//   const auth = await requireRole(STAFF_ROLES);
//   if (auth instanceof Response) return auth;
export async function requireRole(allowed: readonly Role[]): Promise<ApiUser | Response> {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!allowed.includes(user.role)) return forbidden();
  return user;
}
