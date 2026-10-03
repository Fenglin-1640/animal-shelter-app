import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toAssessmentTask } from "@/lib/adoption-fitness/serialize";
import type { AssessmentTask } from "@/lib/adoption-fitness/types";
import { requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.AssessmentTask.where({}).all();
  return NextResponse.json({ items: rows.map(toAssessmentTask) });
}

export async function POST(request: Request) {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as AssessmentTask;
  const created = await db.orm.AssessmentTask.create({
    id: body.id,
    animalId: body.animalId,
    taskType: body.taskType,
    status: body.status,
    markedByEmail: body.markedByEmail ?? null,
    markedByName: body.markedByName ?? null,
    markedAt: toTimestamptz(body.markedAt ?? null),
  });
  return NextResponse.json({ ok: true, item: toAssessmentTask(created) });
}
