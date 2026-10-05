import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toFitnessReview } from "@/lib/adoption-fitness/serialize";
import type { FitnessReview } from "@/lib/adoption-fitness/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, STAFF, isOwnRecord } from "@/lib/auth/api-roles";

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
  // Only the Shelter Staff half is confirmed here (Staff/Administrator);
  // the Veterinarian half is recorded by issuing a Medical Clearance
  // (POST /api/medical/clearances).
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as FitnessReview;
  // BR-016 joint confirmation: Shelter Staff/Administrator record the
  // Staff half in their own name; the Veterinarian half (set by a Medical
  // Clearance) is kept exactly as stored.
  const stored = await db.orm.FitnessReview.where({ animalId: body.animalId }).first();
  const existing: FitnessReview = stored ? toFitnessReview(stored) : { animalId: body.animalId };
  if (!isOwnRecord(auth, body.staffConfirmedByEmail)) return forbidden();
  const merged: FitnessReview = {
    ...body,
    vetConfirmedByEmail: existing.vetConfirmedByEmail,
    vetConfirmedByName: existing.vetConfirmedByName,
    vetConfirmedAt: existing.vetConfirmedAt,
    vetConfirmationNote: existing.vetConfirmationNote,
  };
  const row = {
    animalId: merged.animalId,
    staffConfirmedByEmail: merged.staffConfirmedByEmail ?? null,
    staffConfirmedByName: merged.staffConfirmedByName ?? null,
    staffConfirmedAt: toTimestamptz(merged.staffConfirmedAt ?? null),
    vetConfirmedByEmail: merged.vetConfirmedByEmail ?? null,
    vetConfirmedByName: merged.vetConfirmedByName ?? null,
    vetConfirmedAt: toTimestamptz(merged.vetConfirmedAt ?? null),
    vetConfirmationNote: merged.vetConfirmationNote ?? null,
  };
  const saved = await db.orm.FitnessReview.upsert({ create: row, update: row });
  return NextResponse.json({ ok: true, item: toFitnessReview(saved) });
}
