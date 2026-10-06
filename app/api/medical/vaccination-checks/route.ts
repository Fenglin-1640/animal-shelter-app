import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { CARE_TEAM, VETERINARIAN } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { ANTIBODY_RESULTS, toAntibodyCheck, type AntibodyCheck, type AntibodyResult } from "@/lib/medical/antibodies";
import { toVaccinationRecord } from "@/lib/medical/serialize";
import {
  applicableVaccineTypes,
  computeCoverage,
  outcomeLabel,
  toVaccinationCheck,
  toVaccinationTask,
  type EvidenceRow,
} from "@/lib/medical/vaccination-check";

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

// Vaccination checks. ?animalId= narrows the list to one animal.
export async function GET(request: Request) {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const animalId = new URL(request.url).searchParams.get("animalId");
  const rows = await db.orm.VaccinationCheck.where(animalId ? { animalId } : {}).all();
  return NextResponse.json({ items: rows.map(toVaccinationCheck) });
}

interface CheckInput {
  animalId?: string;
  checkDate?: string;
  report?: string;
  antibodyRows?: { antigen?: string; result?: string; testDate?: string; expiryDate?: string }[];
  evidence?: EvidenceRow[];
  // The uncovered vaccine types the Veterinarian kept as pending (the
  // rest of the uncovered list is recorded as not applicable).
  pendingVaccineTypes?: string[];
}

function bad(message: string) {
  return NextResponse.json({ ok: false, reason: "invalid", message }, { status: 400 });
}

// Records a Vaccination Check as the signed-in Veterinarian: any new
// antibody results, the outside evidence and the report, then turns the
// vaccine types still not covered (and kept by the Veterinarian) into
// Pending vaccination items. Coverage is recomputed here from the stored
// records, so the result does not depend on what the form showed. One
// transaction, with an audit entry for the check, each antibody result
// and each pending item.
export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as CheckInput;
  const animalId = body.animalId ?? "";
  const checkDate = body.checkDate?.slice(0, 10) ?? "";
  const report = body.report?.trim() ?? "";
  // Up to one day ahead of UTC, so a local "today" east of UTC is accepted.
  const today = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkDate) || checkDate > today) return bad("A check date (not in the future) is required.");
  if (!report) return bad("A report is required.");

  const antibodyRows = (body.antibodyRows ?? []).map((r) => ({
    antigen: r.antigen?.trim() ?? "",
    result: r.result ?? "",
    testDate: r.testDate?.slice(0, 10) ?? "",
    expiryDate: r.expiryDate?.slice(0, 10) ?? "",
  }));
  for (const r of antibodyRows) {
    if (!r.antigen || !r.testDate || !(ANTIBODY_RESULTS as readonly string[]).includes(r.result)) return bad("Each antibody result needs an antigen, a result and a test date.");
    if (r.expiryDate && r.expiryDate < r.testDate) return bad("An antibody expiry date must be on or after its test date.");
  }
  const evidence = (body.evidence ?? [])
    .map((e) => ({ vaccineType: e.vaccineType?.trim() ?? "", dateGiven: e.dateGiven?.slice(0, 10) ?? "", source: e.source?.trim() ?? "" }))
    .filter((e) => e.vaccineType || e.dateGiven || e.source);
  if (evidence.some((e) => !e.vaccineType || !e.dateGiven || e.dateGiven > today)) return bad("Each vaccination evidence row needs a vaccine type and a date given (not in the future).");

  const [animal, options, storedAntibodies, vaccinations, existingTasks] = await Promise.all([
    db.orm.Animal.select("animalId", "species").where({ animalId }).first(),
    db.orm.DropdownOption.where({ category: "Vaccine Type" }).all(),
    db.orm.AntibodyCheck.where({ animalId }).all(),
    db.orm.VaccinationRecord.where({ animalId }).all(),
    db.orm.VaccinationTask.select("vaccineType", "status").where({ animalId }).all(),
  ]);
  if (!animal) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const now = new Date().toISOString();
  const newAntibodies = antibodyRows.map((r) => ({
    id: randomId("AB"),
    animalId,
    antigen: r.antigen,
    result: r.result,
    testDate: r.testDate,
    expiryDate: r.expiryDate || null,
    notes: "Recorded with a vaccination check",
    recordedByEmail: auth.email,
    recordedByName: auth.displayName,
    createdAt: toTimestamptz(now),
  }));
  const required = applicableVaccineTypes(
    options.map((o) => ({ value: o.value, speciesId: o.speciesId, isRetired: o.isRetired === 1 })),
    animal.species,
  );
  const allAntibodies: AntibodyCheck[] = [
    ...storedAntibodies.map(toAntibodyCheck),
    ...newAntibodies.map((a) => ({ ...a, result: a.result as AntibodyResult, expiryDate: a.expiryDate ?? undefined, createdAt: now })),
  ];
  const { covered, uncovered } = computeCoverage(required, {
    checkDate,
    antibodyChecks: allAntibodies,
    vaccinations: vaccinations.map(toVaccinationRecord),
    evidence,
  });
  const alreadyPending = new Set(existingTasks.filter((t) => t.status === "Pending").map((t) => t.vaccineType));
  const kept = new Set(body.pendingVaccineTypes ?? uncovered);
  if ([...kept].some((t) => !uncovered.includes(t))) return bad("Only vaccine types that are not covered can be pending.");
  const pending = uncovered.filter((t) => kept.has(t) && !alreadyPending.has(t));
  const notApplicable = uncovered.filter((t) => !kept.has(t));
  const outcome = outcomeLabel(required.length, uncovered.filter((t) => kept.has(t)).length);

  const actor = { email: auth.email, name: auth.displayName };
  const checkRow = {
    id: randomId("VC"),
    animalId,
    checkDate,
    report,
    outcome,
    evidence: JSON.stringify(evidence),
    coverage: JSON.stringify(covered),
    notApplicable: JSON.stringify(notApplicable),
    checkedByEmail: auth.email,
    checkedByName: auth.displayName,
    createdAt: toTimestamptz(now),
  };
  const created = await db.transaction(async (orm) => {
    for (const a of newAntibodies) {
      await orm.AntibodyCheck.create(a);
      await orm.AuditLogEntry.create(
        auditRow({ actor, action: "Record Antibody Check", entityType: "MedicalRecord", entityId: animalId, oldValue: "", newValue: `antigen=${a.antigen}; result=${a.result}; testDate=${a.testDate}${a.expiryDate ? `; expiryDate=${a.expiryDate}` : ""}` }),
      );
    }
    const saved = await orm.VaccinationCheck.create(checkRow);
    await orm.AuditLogEntry.create(
      auditRow({
        actor,
        action: "Record Vaccination Check",
        entityType: "MedicalRecord",
        entityId: animalId,
        oldValue: "",
        newValue: `checkDate=${checkDate}; outcome=${outcome}; covered=${covered.map((c) => c.vaccineType).join("/") || "none"}; pending=${pending.join("/") || "none"}${notApplicable.length ? `; not applicable=${notApplicable.join("/")}` : ""}`,
      }),
    );
    const tasks = [];
    for (const vaccineType of pending) {
      const task = await orm.VaccinationTask.create({
        id: randomId("VT"),
        animalId,
        checkId: checkRow.id,
        vaccineType,
        status: "Pending",
        dueDate: null,
        waivedReason: null,
        createdByEmail: auth.email,
        createdByName: auth.displayName,
        createdAt: toTimestamptz(now),
        completedVaccinationId: null,
        resolvedByEmail: null,
        resolvedByName: null,
        resolvedAt: null,
      });
      await orm.AuditLogEntry.create(
        auditRow({ actor, action: "Create Pending Vaccination", entityType: "MedicalRecord", entityId: animalId, oldValue: "", newValue: `vaccineType=${vaccineType}; checkId=${checkRow.id}` }),
      );
      tasks.push(task);
    }
    return { check: saved, tasks };
  });
  return NextResponse.json({ ok: true, item: toVaccinationCheck(created.check), tasks: created.tasks.map(toVaccinationTask) });
}
