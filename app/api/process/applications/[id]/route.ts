import { NextResponse } from "next/server";
import { CARE_TEAM, isOwnRecord, seesAllRecords } from "@/lib/auth/api-roles";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { APPLICATION_STEPS, computeJourney, needsRole } from "@/lib/process/engine";
import { loadAnimalRecords } from "@/lib/process/load";

// One application's journey (Application -> Rehomed), for the Adopter's
// own application page and the staff application views. Steps carry no
// internal medical or behaviour detail.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole([...CARE_TEAM, "Adopter"]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const app = await db.orm.AdoptionApplication.where({ applicationId: id }).first();
  if (!app) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (!seesAllRecords(auth.role) && !isOwnRecord(auth, app.adopterEmail)) return forbidden();
  const records = (await loadAnimalRecords(app.animalId)).get(app.animalId);
  if (!records) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const application = records.applications.find((a) => a.applicationId === id);
  const steps = computeJourney(records, application).filter((s) => APPLICATION_STEPS.includes(s.key));
  return NextResponse.json({
    ok: true,
    applicationId: id,
    steps: steps.map((s) => ({ ...s, needsMe: needsRole(s, auth.role) })),
  });
}
