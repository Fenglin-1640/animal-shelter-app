import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionAgreement } from "@/lib/agreements/serialize";
import type { AdoptionAgreement } from "@/lib/agreements/types";

export async function GET() {
  const rows = await db.orm.AdoptionAgreement.where({}).all();
  return NextResponse.json({ items: rows.map(toAdoptionAgreement) });
}

export async function POST(request: Request) {
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
    generatedAt: new Date(body.generatedAt),
    generatedByEmail: body.generatedByEmail,
    generatedByName: body.generatedByName,
    isSigned: body.isSigned ? 1 : 0,
    signedDate: body.signedDate ? new Date(body.signedDate) : null,
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toAdoptionAgreement(created) });
}
