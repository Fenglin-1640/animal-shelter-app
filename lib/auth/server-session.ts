import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { formatDisplayName } from "@/lib/auth/format-name";
import { db } from "@/lib/db/client";
import type { Role } from "@/lib/roles/roles";

// Server-verified sign-in session for the API routes. Sign In returns a
// token holding the account id and an expiry, signed with HMAC-SHA256.
// The browser keeps it per tab (sessionStorage) and sends it as
// "Authorization: Bearer <token>" on every API request - deliberately not
// a cookie, which the whole browser profile would share: each tab can be
// signed in as a different account, and signing in or out in one tab
// never affects another. Every request verifies the token and re-reads
// the account, so a role change or deactivation by an Administrator
// applies to the very next request.

// Pre-per-tab-token sessions used this cookie; Sign In clears any that is
// left so it can't linger. Nothing authenticates from it.
export const LEGACY_SESSION_COOKIE = "asams_session";
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

export function clearLegacySessionCookie(response: NextResponse) {
  response.cookies.set(LEGACY_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

// The signed-in account row and token for this request, or null when
// there is no valid session or the account is no longer Active (or is
// locked).
async function getSessionAccount() {
  const authorization = (await headers()).get("authorization") ?? "";
  const session = readSessionToken(authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined);
  if (!session) return null;
  const account = await db.orm.User.where({ id: session.userId }).first();
  if (!account || account.status !== "Active" || account.lockedAt) return null;
  return { account, session };
}

// The signed-in user as the browser keeps it (the same shape Sign In
// returns), for restoring a tab's session on page load - plus a renewed
// token when the current one was issued more than RENEW_AFTER_SECONDS ago
// (the browser asks for renewal through this route at most hourly, see
// lib/shared/http.ts).
export async function getSessionUser() {
  const found = await getSessionAccount();
  if (!found) return null;
  const { account, session } = found;
  const issuedAt = session.expiresAt - SESSION_TTL_SECONDS;
  const renewedToken = Date.now() / 1000 - issuedAt > RENEW_AFTER_SECONDS ? createSessionToken(account.id) : undefined;
  const user = {
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
  return { user, renewedToken };
}

export async function getApiUser(): Promise<ApiUser | null> {
  const found = await getSessionAccount();
  if (!found) return null;
  const { account } = found;
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

// Signed photo image URLs. An <img> can't send the Authorization header,
// so GET /api/photos/:id/image is authorised by a signature in its URL
// instead. The URLs are only handed out inside photo lists, which are
// themselves role-checked and filtered (Adopters/Council get public photos
// only). The expiry is bucketed to a whole UTC day, so a photo's URL stays
// identical within a day (24-48 h validity) and the browser cache keeps
// working.
const IMAGE_URL_BUCKET_SECONDS = 24 * 60 * 60;

function imageSignature(photoId: string, expiresAt: number): string {
  return sign(`image.${photoId}.${expiresAt}`);
}

export function signedPhotoImageUrl(photoId: string, now = Date.now()): string {
  const expiresAt = (Math.floor(now / 1000 / IMAGE_URL_BUCKET_SECONDS) + 2) * IMAGE_URL_BUCKET_SECONDS;
  return `/api/photos/${encodeURIComponent(photoId)}/image?exp=${expiresAt}&sig=${imageSignature(photoId, expiresAt)}`;
}

// Seconds the signed URL stays valid, or null when the signature or
// expiry is invalid.
export function verifyPhotoImageUrl(photoId: string, exp: string | null, sig: string | null): number | null {
  const expiresAt = Number(exp);
  if (!sig || !Number.isFinite(expiresAt)) return null;
  const expected = Buffer.from(imageSignature(photoId, expiresAt));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const remaining = expiresAt - Math.floor(Date.now() / 1000);
  return remaining > 0 ? remaining : null;
}
