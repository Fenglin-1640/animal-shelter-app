import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toHealthAssessment } from "@/lib/medical/serialize";
import type { HealthAssessment } from "@/lib/medical/types";

// FR-MED-01. Like /api/animals, this returns every row and callers
// filter by animalId client-side (lib/medical/store.ts) - consistent
// with the rest of this prototype's "fetch all, filter locally" pattern
// rather than a query-param API, and fine at this data scale.
export async function GET() {
  const rows = await db.orm.HealthAssessment.where({}).all();
  return NextResponse.json({ items: rows.map(toHealthAssessment) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as HealthAssessment;
  const created = await db.orm.HealthAssessment.create({
    id: body.id,
    animalId: body.animalId,
    examinationObservations: body.examinationObservations,
    sampleTestResults: body.sampleTestResults,
    diagnosedConditions: body.diagnosedConditions,
    bodyCondition: body.bodyCondition,
    urgentTreatmentRequired: body.urgentTreatmentRequired ? 1 : 0,
    urgentTreatmentNotes: body.urgentTreatmentNotes,
    treatmentPathway: body.treatmentPathway ?? null,
    healthRecheckRequired: body.healthRecheckRequired ? 1 : 0,
    assessmentDate: body.assessmentDate,
    veterinarianEmail: body.veterinarianEmail,
    veterinarianName: body.veterinarianName,
    createdAt: new Date(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toHealthAssessment(created) });
}
