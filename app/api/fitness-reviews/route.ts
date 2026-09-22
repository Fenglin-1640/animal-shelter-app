import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toFitnessReview } from "@/lib/adoption-fitness/serialize";
import type { FitnessReview } from "@/lib/adoption-fitness/types";
import { toTimestamptz } from "@/lib/db/temporal";

export async function GET() {
  const rows = await db.orm.FitnessReview.where({}).all();
  return NextResponse.json({ items: rows.map(toFitnessReview) });
}

// Upsert, not create - there is exactly one FitnessReview per Animal
// (keyed by animalId), and the caller always submits the complete
// record wholesale rather than a partial patch, same reasoning as
// AdopterProfile's single GET (list) + POST (upsert) pair.
export async function POST(request: Request) {
  const body = (await request.json()) as FitnessReview;
  const row = {
    animalId: body.animalId,
    staffConfirmedByEmail: body.staffConfirmedByEmail ?? null,
    staffConfirmedByName: body.staffConfirmedByName ?? null,
    staffConfirmedAt: toTimestamptz(body.staffConfirmedAt ?? null),
    vetConfirmedByEmail: body.vetConfirmedByEmail ?? null,
    vetConfirmedByName: body.vetConfirmedByName ?? null,
    vetConfirmedAt: toTimestamptz(body.vetConfirmedAt ?? null),
  };
  const saved = await db.orm.FitnessReview.upsert({ create: row, update: row });
  return NextResponse.json({ ok: true, item: toFitnessReview(saved) });
}
