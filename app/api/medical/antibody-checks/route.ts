import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { CARE_TEAM, VETERINARIAN } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { ANTIBODY_RESULTS, toAntibodyCheck } from "@/lib/medical/antibodies";
import { antigenKey } from "@/lib/medical/vaccine-model";
import { invalid, loadVaccineModel } from "@/lib/medical/vaccine-model-server";

// Antibody (titre) checks. ?animalId= narrows the list to one animal.
export async function GET(request: Request) {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const animalId = new URL(request.url).searchParams.get("animalId");
  const rows = await db.orm.AntibodyCheck.where(animalId ? { animalId } : {}).all();
  return NextResponse.json({ items: rows.map(toAntibodyCheck) });
}

interface AntibodyCheckInput {
  animalId?: string;
  antigen?: string;
  result?: string;
  testDate?: string;
  expiryDate?: string;
  notes?: string;
}

// Recorded by the signed-in Veterinarian, audited in the same transaction.
export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as AntibodyCheckInput;
  const antigen = body.antigen?.trim();
  if (!body.animalId || !antigen || !body.testDate || !(ANTIBODY_RESULTS as readonly string[]).includes(body.result ?? "")) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  if (body.expiryDate && new Date(body.expiryDate).getTime() < new Date(body.testDate).getTime()) {
    return NextResponse.json({ ok: false, reason: "expiry_before_test" }, { status: 400 });
  }
  const animal = await db.orm.Animal.select("animalId", "species").where({ animalId: body.animalId }).first();
  if (!animal) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  // Only antigens of the vaccine types that apply to this species.
  const model = await loadVaccineModel(animal.species);
  const label = model.antigenLabels.get(antigenKey(antigen));
  if (!label) return invalid(`${antigen} is not an antigen for ${animal.species}.`);

  const row = {
    id: `AB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    animalId: body.animalId,
    antigen: label,
    result: body.result!,
    testDate: body.testDate,
    expiryDate: body.expiryDate || null,
    notes: body.notes?.trim() ?? "",
    recordedByEmail: auth.email,
    recordedByName: auth.displayName,
    createdAt: toTimestamptz(new Date().toISOString()),
  };
  const created = await db.transaction(async (orm) => {
    const saved = await orm.AntibodyCheck.create(row);
    await orm.AuditLogEntry.create(
      auditRow({
        actor: { email: auth.email, name: auth.displayName },
        action: "Record Antibody Check",
        entityType: "MedicalRecord",
        entityId: row.animalId,
        oldValue: "",
        newValue: `antigen=${antigen}; result=${row.result}; testDate=${row.testDate}${row.expiryDate ? `; expiryDate=${row.expiryDate}` : ""}`,
      }),
    );
    return saved;
  });
  return NextResponse.json({ ok: true, item: toAntibodyCheck(created) });
}
