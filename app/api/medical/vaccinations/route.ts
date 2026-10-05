import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { auditRow } from "@/lib/audit/server";
import { existingAntibodiesFor, isValidOverride, toAntibodyCheck } from "@/lib/medical/antibodies";
import { toVaccinationRecord } from "@/lib/medical/serialize";
import type { VaccinationRecord } from "@/lib/medical/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, VETERINARIAN } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.VaccinationRecord.where({}).all();
  return NextResponse.json({ items: rows.map(toVaccinationRecord) });
}

// Recorded by the signed-in Veterinarian and audited in the same
// transaction. If a current antibody check already shows protection
// against this vaccine, one of the listed reasons is required (refused
// with 409 antibodies_present otherwise) and saved with the record.
export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as VaccinationRecord;
  const checks = (await db.orm.AntibodyCheck.where({ animalId: body.animalId }).all()).map(toAntibodyCheck);
  const covered = existingAntibodiesFor(body.vaccineType, checks);
  const reason = covered.length > 0 ? body.antibodyOverrideReason : undefined;
  const note = covered.length > 0 ? body.antibodyOverrideNote?.trim() || undefined : undefined;
  if (covered.length > 0 && !isValidOverride(reason, note)) {
    return NextResponse.json({ ok: false, reason: "antibodies_present", antigens: covered }, { status: 409 });
  }
  const row = {
    id: body.id,
    animalId: body.animalId,
    vaccineType: body.vaccineType,
    administrationDate: body.administrationDate,
    doseOrChipId: body.doseOrChipId,
    nextBoosterDueDate: body.nextBoosterDueDate,
    veterinarianEmail: auth.email,
    veterinarianName: auth.displayName,
    createdAt: toTimestamptz(body.createdAt),
    antibodyOverrideReason: reason ?? null,
    antibodyOverrideNote: note ?? null,
  };
  const created = await db.transaction(async (orm) => {
    const saved = await orm.VaccinationRecord.create(row);
    await orm.AuditLogEntry.create(
      auditRow({
        actor: { email: auth.email, name: auth.displayName },
        action: "Record Vaccination",
        entityType: "MedicalRecord",
        entityId: row.animalId,
        oldValue: "",
        newValue:
          `vaccineType=${row.vaccineType}; administrationDate=${row.administrationDate}` +
          (reason ? `; given despite existing antibodies (${covered.join(", ")}): ${reason}${note ? ` - ${note}` : ""}` : ""),
      }),
    );
    return saved;
  });
  return NextResponse.json({ ok: true, item: toVaccinationRecord(created) });
}
