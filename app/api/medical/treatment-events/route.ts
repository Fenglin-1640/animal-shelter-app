import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTreatmentEvent } from "@/lib/medical/serialize";
import type { TreatmentEvent } from "@/lib/medical/types";
import { toTimestamptz } from "@/lib/db/temporal";

export async function GET() {
  const rows = await db.orm.TreatmentEvent.where({}).all();
  return NextResponse.json({ items: rows.map(toTreatmentEvent) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as TreatmentEvent;
  const created = await db.orm.TreatmentEvent.create({
    id: body.id,
    animalId: body.animalId,
    linkedHealthAssessmentId: body.linkedHealthAssessmentId,
    medication: body.medication,
    dose: body.dose,
    date: body.date,
    outcome: body.outcome,
    furtherTreatmentRequired: body.furtherTreatmentRequired ? 1 : 0,
    veterinarianEmail: body.veterinarianEmail,
    veterinarianName: body.veterinarianName,
    createdAt: toTimestamptz(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toTreatmentEvent(created) });
}
