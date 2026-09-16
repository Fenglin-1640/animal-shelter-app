import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

function generateAccountId(): string {
  return `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// FR-AUTH-01: public Sign Up always creates an Active Adopter account.
export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const title = String(body.title ?? "");
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");

  const existing = await db.orm.User.where({ email }).first();
  if (existing) {
    return NextResponse.json({ ok: false, reason: "duplicate" });
  }

  const account = await db.orm.User.create({
    id: generateAccountId(),
    email,
    password,
    role: "Adopter",
    status: "Active",
    title,
    firstName,
    lastName,
    phone,
    signUpAt: new Date(),
    failedLoginAttempts: 0,
  });

  return NextResponse.json({ ok: true, accountId: account.id });
}
