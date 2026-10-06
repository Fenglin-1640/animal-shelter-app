import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toIntakeRecord } from "@/lib/intake-records/serialize";
import type { IntakeRecord } from "@/lib/intake-records/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { STAFF } from "@/lib/auth/api-roles";
import { auditRow } from "@/lib/audit/server";

// The list leaves out each intake photo's base64 imageData (the
// photo metadata stays); GET /api/intake-records/:id returns the full
// record for the Intake Record form and Finalise Intake.
export async function GET() {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.IntakeRecord.where({}).all();
  const items = rows.map(toIntakeRecord).map((record) => ({
    ...record,
    photos: record.photos.map((photo) => ({ ...photo, imageData: undefined })),
  }));
  return NextResponse.json({ items });
}

// Saves a new draft Intake Record, audited in the same transaction.
export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as IntakeRecord;
  const created = await db.transaction(async (orm) => {
    const saved = await orm.IntakeRecord.create({
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
      breed: body.breed ?? null,
      adoptionFee: body.adoptionFee ?? null,
      temperaments: JSON.stringify(body.temperaments ?? []),
      generalDescription: body.generalDescription ?? null,
      createdAt: toTimestamptz(body.createdAt),
      updatedAt: toTimestamptz(body.updatedAt),
      finalisedAt: toTimestamptz(body.finalisedAt ?? null),
      registeredOwnerContactName: body.registeredOwnerContact?.name ?? null,
      registeredOwnerContactPhone: body.registeredOwnerContact?.phone ?? null,
      registeredOwnerContactAddress: body.registeredOwnerContact?.address ?? null,
    });
    await orm.AuditLogEntry.create(
      auditRow({
        actor: { email: auth.email, name: auth.displayName },
        action: "Save Intake Record (Draft)",
        entityType: "IntakeRecord",
        entityId: body.intakeId,
        oldValue: "",
        newValue: `animalName=${body.animalName}`,
      }),
    );
    return saved;
  });
  return NextResponse.json({ ok: true, item: toIntakeRecord(created) });
}
