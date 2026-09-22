import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDirectoryUser } from "@/lib/user-administration/serialize";
import { DEMO_PASSWORD } from "@/lib/auth/demo-accounts";
import { toTimestamptz } from "@/lib/db/temporal";

function generateAccountId(): string {
  return `U-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// FR-UA-01: User Administration's list.
export async function GET() {
  const rows = await db.orm.User.where({}).all();
  return NextResponse.json({ users: rows.map(toDirectoryUser) });
}

// FR-UA-02: Administrator creates a user directly with any role except
// Administrator (PRD 4.1 - Administrator is only reachable via transfer).
export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const title = String(body.title ?? "");
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const role = String(body.role ?? "");
  const status = body.status === "Inactive" ? "Inactive" : "Active";
  const createdBy = String(body.createdBy ?? "");

  const existing = await db.orm.User.where({ email }).first();
  if (existing) {
    return NextResponse.json({ ok: false, reason: "duplicate" });
  }

  const now = new Date().toISOString();
  const account = await db.orm.User.create({
    id: generateAccountId(),
    email,
    password: DEMO_PASSWORD,
    role,
    status,
    title,
    firstName,
    lastName,
    phone,
    signUpAt: toTimestamptz(now),
    failedLoginAttempts: 0,
    ...(status === "Inactive"
      ? { statusUpdatedBy: createdBy, statusUpdatedAt: toTimestamptz(now) }
      : {}),
  });

  return NextResponse.json({ ok: true, userId: account.id });
}
