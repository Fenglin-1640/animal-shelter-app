import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toIntakeRecord } from "@/lib/intake-records/serialize";
import type { IntakeRecord } from "@/lib/intake-records/types";

export async function GET() {
  const rows = await db.orm.IntakeRecord.where({}).all();
  return NextResponse.json({ items: rows.map(toIntakeRecord) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as IntakeRecord;
  const created = await db.orm.IntakeRecord.create({
    intakeId: body.intakeId,
    animalId: body.animalId,
    createdByEmail: body.createdByEmail,
    createdByName: body.createdByName,
    animalName: body.animalName,
    arrivalCircumstance: body.arrivalCircumstance,
    arrivalDateTime: body.arrivalDateTime,
    intakeSource: body.intakeSource,
    surrenderingPartyName: body.surrenderingPartyName,
    councilTransferSubmissionId: body.councilTransferSubmissionId ?? null,
    species: body.species,
    estimatedAge: body.estimatedAge,
    dateOfBirth: body.dateOfBirth,
    sex: body.sex,
    coatColour: body.coatColour,
    coatMarkings: body.coatMarkings,
    photos: JSON.stringify(body.photos),
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
    finalisedAt: body.finalisedAt ? new Date(body.finalisedAt) : null,
    registeredOwnerContactName: body.registeredOwnerContact?.name ?? null,
    registeredOwnerContactPhone: body.registeredOwnerContact?.phone ?? null,
    registeredOwnerContactAddress: body.registeredOwnerContact?.address ?? null,
  });
  return NextResponse.json({ ok: true, item: toIntakeRecord(created) });
}
