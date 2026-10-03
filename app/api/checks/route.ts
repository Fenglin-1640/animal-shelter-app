import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toSuitabilityCheck } from "@/lib/checks/serialize";
import type { SuitabilityCheck } from "@/lib/checks/types";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ADOPTER, CARE_TEAM, isOwnRecord, seesAllRecords } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole([...CARE_TEAM, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.SuitabilityCheck.where({}).all();
  if (seesAllRecords(auth.role)) return NextResponse.json({ items: rows.map(toSuitabilityCheck) });
  // An Adopter sees only the checks on their own applications (PRD 9:
  // "仅结果状态").
  const own = new Set(
    (await db.orm.AdoptionApplication.where({}).all())
      .filter((a) => isOwnRecord(auth, a.adopterEmail))
      .map((a) => a.applicationId),
  );
  return NextResponse.json({ items: rows.filter((r) => own.has(r.applicationId)).map(toSuitabilityCheck) });
}

export async function POST(request: Request) {
  const auth = await requireRole(ADOPTER);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as SuitabilityCheck;
  // Checks are created when an Adopter submits their own application.
  const application = await db.orm.AdoptionApplication.where({ applicationId: body.applicationId }).first();
  if (!application || !isOwnRecord(auth, application.adopterEmail)) return forbidden();
  const created = await db.orm.SuitabilityCheck.create({
    checkId: body.checkId,
    applicationId: body.applicationId,
    checkType: body.checkType,
    outcome: body.outcome,
    checkNotes: body.checkNotes,
    conductedDate: body.conductedDate ?? null,
    completedByEmail: body.completedByEmail ?? null,
    completedByName: body.completedByName ?? null,
  });
  return NextResponse.json({ ok: true, item: toSuitabilityCheck(created) });
}
