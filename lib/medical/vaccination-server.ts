import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import type { ApiUser } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { flaggedAntigens, isValidOverride, toAntibodyCheck } from "@/lib/medical/antibodies";
import { toVaccinationRecord } from "@/lib/medical/serialize";
import type { VaccinationRecord } from "@/lib/medical/types";
import { coveredAntigens } from "@/lib/medical/vaccination-check";
import { findType, type ResolvedVaccineType } from "@/lib/medical/vaccine-model";
import { invalid, loadVaccineModel } from "@/lib/medical/vaccine-model-server";

export interface VaccinationItemInput {
  vaccineType?: string;
  doseOrChipId?: string;
  nextBoosterDueDate?: string;
  antibodyOverrideReason?: string;
  antibodyOverrideNote?: string;
  // The pending vaccination item this administers (optional: a pending
  // item for the same vaccine type is matched automatically).
  vaccinationTaskId?: string;
}

export interface VaccinationBatchInput {
  animalId?: string;
  administrationDate?: string;
  items?: VaccinationItemInput[];
}

class Conflict extends Error {}

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function bad(message: string) {
  return NextResponse.json({ ok: false, reason: "invalid", message }, { status: 400 });
}

// Records one or more vaccinations given together (one shared date, a
// dose and booster date per vaccine) as the signed-in Veterinarian, all
// or nothing:
//   - each vaccine type must apply to the animal's species (422);
//   - a vaccine covering an antigen with a current Protective antibody
//     result needs one of the listed reasons; if any is missing nothing is
//     saved and the response lists every flagged vaccine (409);
//   - each vaccine completes its pending item, and any other pending item
//     whose antigens are now all covered is completed too;
//   - everything, with an audit entry per change, is one transaction. A
//     pending item completed by someone else meanwhile rolls it all back.
export async function recordVaccinationBatch(auth: ApiUser, body: VaccinationBatchInput): Promise<Response> {
  const animalId = body.animalId ?? "";
  const administrationDate = body.administrationDate?.trim() ?? "";
  const items = body.items ?? [];
  const latest = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (!animalId || !/^\d{4}-\d{2}-\d{2}/.test(administrationDate) || administrationDate.slice(0, 10) > latest) {
    return bad("An administration date (not in the future) is required.");
  }
  if (items.length === 0 || items.length > 10) return bad("Select between 1 and 10 vaccines.");
  if (items.some((i) => !i.vaccineType?.trim() || !i.doseOrChipId?.trim())) return bad("Each vaccine needs a type and a dose or batch ID.");

  const animal = await db.orm.Animal.select("animalId", "species").where({ animalId }).first();
  if (!animal) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const [model, antibodyRows, vaccinationRows, taskRows] = await Promise.all([
    loadVaccineModel(animal.species),
    db.orm.AntibodyCheck.where({ animalId }).all(),
    db.orm.VaccinationRecord.where({ animalId }).all(),
    db.orm.VaccinationTask.where({ animalId, status: "Pending" }).all(),
  ]);
  const antibodies = antibodyRows.map(toAntibodyCheck);

  const resolved: { item: VaccinationItemInput; type: ResolvedVaccineType; flagged: string[]; taskId?: string }[] = [];
  for (const item of items) {
    const type = findType(item.vaccineType!, model.types);
    if (!type) return invalid(`${item.vaccineType} is not a vaccine type for ${animal.species}.`);
    if (resolved.some((r) => r.type.id === type.id)) return bad(`${type.value} is selected more than once.`);
    const task = item.vaccinationTaskId
      ? taskRows.find((t) => t.id === item.vaccinationTaskId)
      : taskRows.find((t) => findType(t.vaccineType, model.all)?.id === type.id);
    if (item.vaccinationTaskId && !task) return NextResponse.json({ ok: false, reason: "not_pending", message: "That pending vaccination is no longer pending." }, { status: 409 });
    if (task && findType(task.vaccineType, model.all)?.id !== type.id) return bad(`The pending item is for ${task.vaccineType}, not ${type.value}.`);
    resolved.push({ item, type, flagged: flaggedAntigens(type, antibodies), taskId: task?.id });
  }
  const missing = resolved.filter((r) => r.flagged.length > 0 && !isValidOverride(r.item.antibodyOverrideReason, r.item.antibodyOverrideNote?.trim()));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: "antibodies_present",
        flagged: resolved.filter((r) => r.flagged.length > 0).map((r) => ({ vaccineType: r.type.value, antigens: r.flagged })),
        missing: missing.map((r) => r.type.value),
        antigens: missing[0].flagged,
      },
      { status: 409 },
    );
  }

  const actor = { email: auth.email, name: auth.displayName };
  const now = new Date().toISOString();
  try {
    const created = await db.transaction(async (orm) => {
      const records: VaccinationRecord[] = [];
      for (const r of resolved) {
        const reason = r.flagged.length > 0 ? r.item.antibodyOverrideReason : undefined;
        const note = r.flagged.length > 0 ? r.item.antibodyOverrideNote?.trim() || undefined : undefined;
        const row = {
          id: randomId("VAC"),
          animalId,
          vaccineType: r.type.value,
          administrationDate,
          doseOrChipId: r.item.doseOrChipId!.trim(),
          nextBoosterDueDate: r.item.nextBoosterDueDate?.trim() ?? "",
          veterinarianEmail: auth.email,
          veterinarianName: auth.displayName,
          createdAt: toTimestamptz(now),
          antibodyOverrideReason: reason ?? null,
          antibodyOverrideNote: note ?? null,
        };
        records.push(toVaccinationRecord(await orm.VaccinationRecord.create(row)));
        await orm.AuditLogEntry.create(
          auditRow({
            actor,
            action: "Record Vaccination",
            entityType: "MedicalRecord",
            entityId: animalId,
            oldValue: "",
            newValue:
              `vaccineType=${row.vaccineType}; administrationDate=${administrationDate}` +
              (resolved.length > 1 ? `; given with ${resolved.filter((x) => x !== r).map((x) => x.type.value).join(", ")}` : "") +
              (reason ? `; given despite existing antibodies (${r.flagged.join(", ")}): ${reason}${note ? ` - ${note}` : ""}` : ""),
          }),
        );
        if (r.taskId) {
          const done = await orm.VaccinationTask.where({ id: r.taskId, status: "Pending" }).update({
            status: "Completed",
            completedVaccinationId: row.id,
            resolvedByEmail: auth.email,
            resolvedByName: auth.displayName,
            resolvedAt: toTimestamptz(now),
          });
          if (!done) throw new Conflict();
          await orm.AuditLogEntry.create(
            auditRow({ actor, action: "Complete Pending Vaccination", entityType: "MedicalRecord", entityId: animalId, oldValue: `vaccineType=${r.type.value}; status=Pending`, newValue: `status=Completed; vaccinationId=${row.id}` }),
          );
        }
      }
      // Other pending items now fully covered (e.g. Kennel Cough once C5 is given).
      // As of the administration date when it is ahead of UTC's "today".
      const asOf = administrationDate.slice(0, 10) > now.slice(0, 10) ? administrationDate.slice(0, 10) : now.slice(0, 10);
      const covered = coveredAntigens(model, {
        checkDate: asOf,
        antibodyChecks: antibodies,
        vaccinations: [...vaccinationRows.map(toVaccinationRecord), ...records],
        evidence: [],
      });
      const handled = new Set(resolved.map((r) => r.taskId).filter(Boolean));
      for (const task of taskRows.filter((t) => !handled.has(t.id))) {
        const type = findType(task.vaccineType, model.all);
        if (!type || type.antigens.length === 0 || !type.antigens.every((a) => covered.has(a))) continue;
        const done = await orm.VaccinationTask.where({ id: task.id, status: "Pending" }).update({
          status: "Completed",
          completedVaccinationId: records[records.length - 1].id,
          resolvedByEmail: auth.email,
          resolvedByName: auth.displayName,
          resolvedAt: toTimestamptz(now),
        });
        if (!done) throw new Conflict();
        await orm.AuditLogEntry.create(
          auditRow({
            actor,
            action: "Complete Pending Vaccination",
            entityType: "MedicalRecord",
            entityId: animalId,
            oldValue: `vaccineType=${task.vaccineType}; status=Pending`,
            newValue: `status=Completed; covered by ${records.map((x) => x.vaccineType).join(", ")}`,
          }),
        );
      }
      return records;
    });
    return NextResponse.json({ ok: true, items: created, item: created[0] });
  } catch (e) {
    if (e instanceof Conflict) {
      return NextResponse.json({ ok: false, reason: "not_pending", message: "A pending vaccination was completed by someone else. Nothing was saved - please reload." }, { status: 409 });
    }
    throw e;
  }
}
