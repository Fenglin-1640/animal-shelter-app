import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toAdoptionApplication } from "@/lib/applications/serialize";
import type { AdoptionApplication } from "@/lib/applications/types";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ADOPTER, ALL_ROLES, isOwnRecord, seesAllRecords } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.AdoptionApplication.where({}).all();
  // Adopters see only their own records; the care team sees all.
  const items = rows.map(toAdoptionApplication).filter((item) => seesAllRecords(auth.role) || isOwnRecord(auth, item.adopterEmail));
  return NextResponse.json({ items });
}

// FR-APP-01: startOrContinueDraft() creates a new Draft application.
export async function POST(request: Request) {
  const auth = await requireRole(ADOPTER);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as AdoptionApplication;
  // An Adopter can only start an application in their own name.
  if (!isOwnRecord(auth, body.adopterEmail)) return forbidden();
  const created = await db.orm.AdoptionApplication.create({
    applicationId: body.applicationId,
    adopterEmail: body.adopterEmail,
    adopterName: body.adopterName,
    animalId: body.animalId,
    animalName: body.animalName,
    animalSpecies: body.animalSpecies,
    animalBreed: body.animalBreed,
    adoptionFee: body.adoptionFee ?? null,
    motivationStatement: body.motivationStatement,
    documents: JSON.stringify(body.documents),
    profileSnapshot: body.profileSnapshot ? JSON.stringify(body.profileSnapshot) : null,
    applicationStatus: body.applicationStatus,
    submissionDate: toTimestamptz(body.submissionDate ?? null),
    decisionDate: toTimestamptz(body.decisionDate ?? null),
    decisionByEmail: body.decisionByEmail ?? null,
    decisionByName: body.decisionByName ?? null,
    rejectionReason: body.rejectionReason ?? null,
    createdAt: toTimestamptz(body.createdAt),
    updatedAt: toTimestamptz(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toAdoptionApplication(created) });
}
