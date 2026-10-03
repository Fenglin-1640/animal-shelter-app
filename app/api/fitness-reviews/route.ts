import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toFitnessReview } from "@/lib/adoption-fitness/serialize";
import type { FitnessReview } from "@/lib/adoption-fitness/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, isOwnRecord } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.FitnessReview.where({}).all();
  return NextResponse.json({ items: rows.map(toFitnessReview) });
}

// Upsert, not create - there is exactly one FitnessReview per Animal
// (keyed by animalId), and the caller always submits the complete
// record wholesale rather than a partial patch, same reasoning as
// AdopterProfile's single GET (list) + POST (upsert) pair.
export async function POST(request: Request) {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as FitnessReview;
  // BR-016 joint confirmation: a Veterinarian records only the Veterinarian
  // side and Shelter Staff Member/Administrator only the Staff side, each
  // in their own name; the other side is kept exactly as stored.
  const stored = await db.orm.FitnessReview.where({ animalId: body.animalId }).first();
  const existing: FitnessReview = stored ? toFitnessReview(stored) : { animalId: body.animalId };
  const isVet = auth.role === "Veterinarian";
  if (!isOwnRecord(auth, isVet ? body.vetConfirmedByEmail : body.staffConfirmedByEmail)) return forbidden();
  const merged: FitnessReview = isVet
    ? { ...body, staffConfirmedByEmail: existing.staffConfirmedByEmail, staffConfirmedByName: existing.staffConfirmedByName, staffConfirmedAt: existing.staffConfirmedAt }
    : { ...body, vetConfirmedByEmail: existing.vetConfirmedByEmail, vetConfirmedByName: existing.vetConfirmedByName, vetConfirmedAt: existing.vetConfirmedAt };
  const row = {
    animalId: merged.animalId,
    staffConfirmedByEmail: merged.staffConfirmedByEmail ?? null,
    staffConfirmedByName: merged.staffConfirmedByName ?? null,
    staffConfirmedAt: toTimestamptz(merged.staffConfirmedAt ?? null),
    vetConfirmedByEmail: merged.vetConfirmedByEmail ?? null,
    vetConfirmedByName: merged.vetConfirmedByName ?? null,
    vetConfirmedAt: toTimestamptz(merged.vetConfirmedAt ?? null),
  };
  const saved = await db.orm.FitnessReview.upsert({ create: row, update: row });
  return NextResponse.json({ ok: true, item: toFitnessReview(saved) });
}
