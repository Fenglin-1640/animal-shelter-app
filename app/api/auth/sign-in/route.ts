import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { LOCKOUT_THRESHOLD } from "@/lib/auth/lockout-config";

// FR-AUTH-01 / PRD 4.1: 6 failed attempts locks the account; Inactive
// accounts are rejected before the password is even checked. Credential
// checking now happens here (server-side) instead of in the browser, so
// the password field never has to reach the client.
export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const account = await db.orm.User.where({ email }).first();

  if (!account) {
    // No row to record a failed attempt against - just report invalid.
    return NextResponse.json({ ok: false, reason: "invalid", attemptsRemaining: LOCKOUT_THRESHOLD });
  }

  if (account.lockedAt) {
    return NextResponse.json({ ok: false, reason: "locked" });
  }

  if (account.status === "Inactive") {
    return NextResponse.json({ ok: false, reason: "inactive" });
  }

  if (account.password !== password) {
    const failedLoginAttempts = account.failedLoginAttempts + 1;
    const lockedAt = failedLoginAttempts >= LOCKOUT_THRESHOLD ? new Date().toISOString() : null;
    await db.orm.User.where({ id: account.id }).update({
      failedLoginAttempts,
      lockedAt: toTimestamptz(lockedAt),
    });

    if (lockedAt) {
      return NextResponse.json({ ok: false, reason: "locked" });
    }
    return NextResponse.json({
      ok: false,
      reason: "invalid",
      attemptsRemaining: LOCKOUT_THRESHOLD - failedLoginAttempts,
    });
  }

  const lastLoginAt = new Date().toISOString();
  await db.orm.User.where({ id: account.id }).update({
    failedLoginAttempts: 0,
    lockedAt: null,
    lastLoginAt: toTimestamptz(lastLoginAt),
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      title: account.title,
      firstName: account.firstName,
      lastName: account.lastName,
      phone: account.phone,
      signUpAt: account.signUpAt,
      lastLoginAt,
    },
  });
}
