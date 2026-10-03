import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toAdoptionAgreement } from "@/lib/agreements/serialize";
import type { AdoptionAgreement } from "@/lib/agreements/types";
import { requireRole } from "@/lib/auth/server-session";
import { ADOPTER, CARE_TEAM, isOwnRecord, seesAllRecords, STAFF } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole([...CARE_TEAM, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.AdoptionAgreement.where({}).all();
  // Adopters see only their own records; the care team sees all.
  const items = rows.map(toAdoptionAgreement).filter((item) => seesAllRecords(auth.role) || isOwnRecord(auth, item.adopterEmail));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as AdoptionAgreement;
  const created = await db.orm.AdoptionAgreement.create({
    agreementId: body.agreementId,
    applicationId: body.applicationId,
    animalId: body.animalId,
    animalName: body.animalName,
    animalSpecies: body.animalSpecies,
    adopterEmail: body.adopterEmail,
    adopterName: body.adopterName,
    agreementVersion: body.agreementVersion,
    templateVersion: body.templateVersion,
    adoptionConditions: body.adoptionConditions,
    returnPolicyPeriod: body.returnPolicyPeriod,
    generatedAt: toTimestamptz(body.generatedAt),
    generatedByEmail: body.generatedByEmail,
    generatedByName: body.generatedByName,
    isSigned: body.isSigned ? 1 : 0,
    signedDate: toTimestamptz(body.signedDate ?? null),
    createdAt: toTimestamptz(body.createdAt),
    updatedAt: toTimestamptz(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toAdoptionAgreement(created) });
}
