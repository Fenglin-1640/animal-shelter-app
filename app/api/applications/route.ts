import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionApplication } from "@/lib/applications/serialize";
import type { AdoptionApplication } from "@/lib/applications/types";

export async function GET() {
  const rows = await db.orm.AdoptionApplication.where({}).all();
  return NextResponse.json({ items: rows.map(toAdoptionApplication) });
}

// FR-APP-01: startOrContinueDraft() creates a new Draft application.
export async function POST(request: Request) {
  const body = (await request.json()) as AdoptionApplication;
  const created = await db.orm.AdoptionApplication.create({
    applicationId: body.applicationId,
    adopterEmail: body.adopterEmail,
    adopterName: body.adopterName,
    animalId: body.animalId,
    animalName: body.animalName,
    animalSpecies: body.animalSpecies,
    animalBreed: body.animalBreed,
    motivationStatement: body.motivationStatement,
    documents: JSON.stringify(body.documents),
    profileSnapshot: body.profileSnapshot ? JSON.stringify(body.profileSnapshot) : null,
    applicationStatus: body.applicationStatus,
    submissionDate: body.submissionDate ? new Date(body.submissionDate) : null,
    decisionDate: body.decisionDate ? new Date(body.decisionDate) : null,
    decisionByEmail: body.decisionByEmail ?? null,
    decisionByName: body.decisionByName ?? null,
    rejectionReason: body.rejectionReason ?? null,
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toAdoptionApplication(created) });
}
