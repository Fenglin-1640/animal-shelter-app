import { NextResponse } from "next/server";
import { VET_CONFIRMATION_NOTE } from "@/lib/adoption-fitness/server";
import { auditRow } from "@/lib/audit/server";
import { CARE_TEAM, VETERINARIAN } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toMedicalClearance } from "@/lib/medical/serialize";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.MedicalClearance.where({}).all();
  return NextResponse.json({ items: rows.map(toMedicalClearance) });
}

// A Veterinarian issues a Medical Clearance. In the same transaction it
// also records the Veterinarian half of Review Adoption Fitness
// ("Confirmed together with Medical Clearance") and audits both - there is
// no separate Vet fitness confirmation any more. Only a Veterinarian can
// do this (not an Administrator).
//
// A clearance can be issued again only when the Vet confirmation it gave
// has since been withdrawn (e.g. by a Statutory Hold), which re-confirms
// fitness; otherwise it is refused as already issued. The issuing
// Veterinarian is taken from the session, not the request.
export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const { animalId } = (await request.json()) as { animalId?: string };
  if (!animalId) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });

  const [animal, existing, review, vaccination, desexing, health] = await Promise.all([
    db.orm.Animal.select("animalId").where({ animalId }).first(),
    db.orm.MedicalClearance.where({ animalId }).first(),
    db.orm.FitnessReview.where({ animalId }).first(),
    db.orm.VaccinationRecord.select("id").where({ animalId }).first(),
    db.orm.DesexingSchedule.select("id").where({ animalId }).first(),
    db.orm.HealthAssessment.select("createdAt", "healthRecheckRequired").where({ animalId }).all(),
  ]);
  if (!animal) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (existing && review?.vetConfirmedAt) return NextResponse.json({ ok: false, reason: "already_issued" }, { status: 409 });
  // Same conditions as getMedicalClearanceBlockers() in lib/medical/store.ts.
  const latestHealth = [...health].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!vaccination || !desexing || latestHealth?.healthRecheckRequired === 1) {
    return NextResponse.json({ ok: false, reason: "blocked" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const actor = { email: auth.email, name: auth.displayName };
  const created = await db.transaction(async (orm) => {
    const clearance = await orm.MedicalClearance.create({
      id: `MC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      animalId,
      issuedByEmail: auth.email,
      issuedByName: auth.displayName,
      issuedAt: toTimestamptz(now),
    });
    const vetHalf = {
      vetConfirmedByEmail: auth.email,
      vetConfirmedByName: auth.displayName,
      vetConfirmedAt: toTimestamptz(now),
      vetConfirmationNote: VET_CONFIRMATION_NOTE,
    };
    if (review) {
      await orm.FitnessReview.where({ animalId }).update(vetHalf);
    } else {
      await orm.FitnessReview.create({
        animalId,
        staffConfirmedByEmail: null,
        staffConfirmedByName: null,
        staffConfirmedAt: null,
        ...vetHalf,
      });
    }
    await orm.AuditLogEntry.create(
      auditRow({ actor, action: "Issue Medical Clearance", entityType: "MedicalRecord", entityId: animalId, oldValue: existing ? "Previous clearance's fitness confirmation withdrawn" : "Not issued", newValue: `Issued by ${auth.displayName}` }),
    );
    await orm.AuditLogEntry.create(
      auditRow({ actor, action: "Review Adoption Fitness - Veterinarian Confirmation", entityType: "Animal", entityId: animalId, oldValue: "", newValue: `${VET_CONFIRMATION_NOTE} by ${auth.displayName}` }),
    );
    return clearance;
  });
  return NextResponse.json({ ok: true, item: toMedicalClearance(created) });
}
