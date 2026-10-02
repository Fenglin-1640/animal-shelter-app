import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toAdopterProfile, toAdopterProfileRow } from "@/lib/adopter-profile/serialize";
import type { AdopterProfile } from "@/lib/adopter-profile/types";

// ?email= narrows the list to that one account's profile.
export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email");
  const rows = await db.orm.AdopterProfile.where(email ? { email } : {}).all();
  return NextResponse.json({ items: rows.map((row) => ({ email: row.email, ...toAdopterProfile(row) })) });
}

// Upsert, not create - there is exactly one profile per Adopter (keyed
// by email), and the form always submits the complete profile wholesale
// rather than a partial patch, so a single POST covers both "save for
// the first time" and "save again" the same way
// lib/adopter-profile/store.ts's saveAdopterProfile always has.
export async function POST(request: Request) {
  const body = (await request.json()) as AdopterProfile & { email: string };
  const row = toAdopterProfileRow(body.email, body);
  const dbRow = { ...row, refereeConsentAt: toTimestamptz(row.refereeConsentAt) };
  const saved = await db.orm.AdopterProfile.upsert({ create: dbRow, update: dbRow });
  return NextResponse.json({ ok: true, item: { email: saved.email, ...toAdopterProfile(saved) } });
}
