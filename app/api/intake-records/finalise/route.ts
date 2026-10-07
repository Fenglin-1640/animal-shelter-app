import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { STAFF } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toIntakeRecord, toIntakeRecordRowPatch } from "@/lib/intake-records/serialize";
import { getFinaliseBlockers, type IntakeRecordFormInput } from "@/lib/intake-records/types";
import { TASK_TYPES } from "@/lib/adoption-fitness/types";

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function shelterId(): string {
  return `SH-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

// Save and Finalise Intake in one step: validates the form, saves the
// Intake Record (new, or an existing draft) and finalises it - creating
// the Animal (Under Assessment / Not Fit), its three assessment tasks
// and its photos (the first one public), accepting a linked Council
// Transfer - with the audit entries, all in one transaction. With only
// an intakeId it finalises the record as stored. If anything is missing,
// nothing is saved and the unmet conditions come back as blockers.
export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as { intakeId?: string; input?: IntakeRecordFormInput };

  const existingRow = body.intakeId ? await db.orm.IntakeRecord.where({ intakeId: body.intakeId }).first() : null;
  if (body.intakeId && !existingRow) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const existing = existingRow ? toIntakeRecord(existingRow) : null;
  if (existing?.finalisedAt) return NextResponse.json({ ok: false, reason: "already_finalised" }, { status: 409 });
  const input = body.input ?? existing;
  if (!input) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });

  const transferId = input.councilTransferSubmissionId || undefined;
  const [transferRow, otherLink] = await Promise.all([
    transferId ? db.orm.CouncilTransferSubmission.where({ id: transferId }).first() : Promise.resolve(null),
    transferId ? db.orm.IntakeRecord.select("intakeId").where({ councilTransferSubmissionId: transferId }).all() : Promise.resolve([]),
  ]);
  const blockers = getFinaliseBlockers(input, transferRow ? toCouncilTransferSubmission(transferRow) : undefined);
  if (otherLink.some((r) => r.intakeId !== existing?.intakeId)) blockers.push("The selected Council Transfer is already linked to another intake record.");
  if (blockers.length > 0) return NextResponse.json({ ok: false, reason: "blocked", blockers }, { status: 400 });

  const species = input.species || "Cat";
  const breedRow = await db.orm.DropdownOption.where({ category: "Breed and Description", speciesId: species, value: input.breed }).first();
  const now = new Date().toISOString();
  const intakeId = existing?.intakeId ?? randomId("IN");
  const animalId = existing?.animalId ?? randomId("A");
  const actor = { email: auth.email, name: auth.displayName };
  const createdByEmail = existing?.createdByEmail ?? auth.email;
  const createdByName = existing?.createdByName ?? auth.displayName;

  const result = await db.transaction(async (orm) => {
    const fields = toIntakeRecordRowPatch({
      animalName: input.animalName,
      arrivalCircumstance: input.arrivalCircumstance,
      arrivalDateTime: input.arrivalDateTime,
      intakeSource: input.intakeSource,
      surrenderingPartyName: input.surrenderingPartyName,
      species: input.species,
      estimatedAge: input.estimatedAge,
      dateOfBirth: input.dateOfBirth,
      sex: input.sex,
      coatColour: input.coatColour,
      coatMarkings: input.coatMarkings,
      photos: input.photos,
      breed: input.breed,
      temperaments: input.temperaments,
      generalDescription: input.generalDescription,
    });
    const row = {
      ...fields,
      councilTransferSubmissionId: transferId ?? null,
      adoptionFee: input.adoptionFee ?? null,
      updatedAt: toTimestamptz(now),
      finalisedAt: toTimestamptz(now),
    };
    if (existing) {
      await orm.IntakeRecord.where({ intakeId }).update(row);
    } else {
      await orm.IntakeRecord.create({
        ...(row as Record<string, unknown>),
        intakeId,
        animalId,
        createdByEmail,
        createdByName,
        createdAt: toTimestamptz(now),
        registeredOwnerContactName: null,
        registeredOwnerContactPhone: null,
        registeredOwnerContactAddress: null,
      } as Parameters<typeof orm.IntakeRecord.create>[0]);
    }
    await orm.AuditLogEntry.create(
      auditRow({ actor, action: existing ? "Save Intake Record" : "Create Intake Record", entityType: "IntakeRecord", entityId: intakeId, oldValue: "", newValue: `animalName=${input.animalName}; species=${species}; photos=${input.photos.length}` }),
    );

    await orm.Animal.create({
      animalId,
      shelterId: shelterId(),
      name: input.animalName,
      species,
      breed: input.breed,
      breedDescription: breedRow?.description ?? "",
      sex: input.sex || "Male",
      dateOfBirth: input.dateOfBirth || null,
      estimatedAge: input.estimatedAge || null,
      coatColour: input.coatColour,
      coatMarkings: input.coatMarkings,
      microchipNumber: null,
      generalDescription: input.generalDescription,
      temperaments: JSON.stringify(input.temperaments),
      adoptionFee: input.adoptionFee ?? null,
      currentStatus: "Under Assessment",
      listingStatus: "Not Fit",
      statusUpdatedAt: toTimestamptz(now),
      enteredAt: toTimestamptz(now),
      lastModifiedAt: toTimestamptz(now),
      intakeSource: input.intakeSource,
      linkedPersonRole: null,
      linkedPersonName: null,
    });
    if (transferId) {
      await orm.AnimalTransferLink.create({ animalId, councilTransferId: transferId, intakeId, createdAt: toTimestamptz(now) });
    }
    for (const taskType of TASK_TYPES) {
      await orm.AssessmentTask.create({ id: randomId("AT"), animalId, taskType, status: "Pending", markedByEmail: null, markedByName: null, markedAt: null });
    }
    for (const [i, p] of input.photos.entries()) {
      await orm.Photo.create({
        id: randomId("PH"),
        animalId,
        fileName: p.fileName,
        fileSizeKB: p.fileSizeKB,
        dateTaken: p.uploadedAt,
        takenByEmail: createdByEmail,
        takenByName: createdByName,
        useOnAdoptionListing: i === 0 ? 1 : 0,
        altText: p.altText?.trim() ?? "",
        uploadedAt: toTimestamptz(p.uploadedAt),
        imageData: p.imageData ?? null,
      });
    }
    if (transferRow && transferRow.status === "Submitted") {
      await orm.CouncilTransferSubmission.where({ id: transferRow.id }).update({ status: "Accepted", updatedAt: toTimestamptz(now) });
    }
    await orm.AuditLogEntry.create(
      auditRow({ actor, action: "Finalise Intake", entityType: "IntakeRecord", entityId: intakeId, oldValue: "", newValue: `animalId=${animalId}` }),
    );
    await orm.AuditLogEntry.create(
      auditRow({ actor, action: "Create Animal (Finalise Intake)", entityType: "Animal", entityId: animalId, oldValue: "", newValue: "currentStatus=Under Assessment, listingStatus=Not Fit" }),
    );
    return { intakeId, animalId };
  });
  return NextResponse.json({ ok: true, ...result });
}
