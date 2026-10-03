import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toAdopterProfile, toAdopterProfileRow } from "@/lib/adopter-profile/serialize";
import type { AdopterProfile } from "@/lib/adopter-profile/types";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ADOPTER, STAFF, isOwnRecord } from "@/lib/auth/api-roles";

// ?email= narrows the list to that one account's profile.
export async function GET(request: Request) {
  const auth = await requireRole([...STAFF, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const requested = new URL(request.url).searchParams.get("email");
  // An Adopter only ever gets their own profile; Staff and Administrator
  // can read any (PRD 9: "处理申请时查看").
  const email = auth.role === "Adopter" ? auth.email : requested;
  const rows = await db.orm.AdopterProfile.where(email ? { email } : {}).all();
  return NextResponse.json({ items: rows.map((row) => ({ email: row.email, ...toAdopterProfile(row) })) });
}

// Upsert, not create - there is exactly one profile per Adopter (keyed
// by email), and the form always submits the complete profile wholesale
// rather than a partial patch, so a single POST covers both "save for
// the first time" and "save again" the same way
// lib/adopter-profile/store.ts's saveAdopterProfile always has.
export async function POST(request: Request) {
  const auth = await requireRole(ADOPTER);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as AdopterProfile & { email: string };
  if (!isOwnRecord(auth, body.email)) return forbidden();
  const row = toAdopterProfileRow(body.email, body);
  const dbRow = { ...row, refereeConsentAt: toTimestamptz(row.refereeConsentAt) };
  const saved = await db.orm.AdopterProfile.upsert({ create: dbRow, update: dbRow });
  return NextResponse.json({ ok: true, item: { email: saved.email, ...toAdopterProfile(saved) } });
}
