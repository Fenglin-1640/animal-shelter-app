import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
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
const SESSION_TTL_SECONDS = 12 * 60 * 60;

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

function readSessionToken(token: string | undefined): string | null {
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
  return userId;
}

export function setSessionCookie(response: NextResponse, request: Request, userId: string) {
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

// The signed-in account for this request, or null when there is no valid
// session or the account is no longer Active (or is locked).
export async function getApiUser(): Promise<ApiUser | null> {
  const userId = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const account = await db.orm.User.where({ id: userId }).first();
  if (!account || account.status !== "Active" || account.lockedAt) return null;
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
