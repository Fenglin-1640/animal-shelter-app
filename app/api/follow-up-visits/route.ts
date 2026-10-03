import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toFollowUpVisit } from "@/lib/follow-up-visits/serialize";
import type { FollowUpVisit } from "@/lib/follow-up-visits/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { ADOPTER, CARE_TEAM, isOwnRecord, seesAllRecords } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole([...CARE_TEAM, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.FollowUpVisit.where({}).all();
  // Adopters see only their own records; the care team sees all.
  const items = rows.map(toFollowUpVisit).filter((item) => seesAllRecords(auth.role) || isOwnRecord(auth, item.adopterEmail));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  // Releasing the animal (which creates the visit) is the Shelter Staff
  // Member's action only - PRD 9's Pre-Release Check row leaves
  // Administrator read-only here.
  const auth = await requireRole(["Shelter Staff Member"]);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as FollowUpVisit;
  const created = await db.orm.FollowUpVisit.create({
    followUpVisitId: body.followUpVisitId,
    animalId: body.animalId,
    animalName: body.animalName,
    applicationId: body.applicationId,
    adopterEmail: body.adopterEmail,
    adopterName: body.adopterName,
    careInstructionsProvided: body.careInstructionsProvided ? 1 : 0,
    releaseDate: body.releaseDate,
    receivingAdopter: body.receivingAdopter,
    releasedByEmail: body.releasedByEmail,
    releasedByName: body.releasedByName,
    targetDate: body.targetDate,
    followUpType: body.followUpType,
    assignedStaffEmail: body.assignedStaffEmail,
    assignedStaffName: body.assignedStaffName,
    status: body.status,
    outcome: body.outcome ?? null,
    outcomeNotes: body.outcomeNotes,
    completedByEmail: body.completedByEmail ?? null,
    completedByName: body.completedByName ?? null,
    completedAt: toTimestamptz(body.completedAt ?? null),
    createdAt: toTimestamptz(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toFollowUpVisit(created) });
}
