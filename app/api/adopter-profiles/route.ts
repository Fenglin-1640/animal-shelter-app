import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdopterProfile, toAdopterProfileRow } from "@/lib/adopter-profile/serialize";
import type { AdopterProfile } from "@/lib/adopter-profile/types";

export async function GET() {
  const rows = await db.orm.AdopterProfile.where({}).all();
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
  const saved = await db.orm.AdopterProfile.upsert({ create: row, update: row });
  return NextResponse.json({ ok: true, item: { email: saved.email, ...toAdopterProfile(saved) } });
}
