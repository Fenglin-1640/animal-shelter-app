import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toFollowUpVisit } from "@/lib/follow-up-visits/serialize";
import type { FollowUpVisit } from "@/lib/follow-up-visits/types";

export async function GET() {
  const rows = await db.orm.FollowUpVisit.where({}).all();
  return NextResponse.json({ items: rows.map(toFollowUpVisit) });
}

export async function POST(request: Request) {
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
    completedAt: body.completedAt ? new Date(body.completedAt) : null,
    createdAt: new Date(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toFollowUpVisit(created) });
}
