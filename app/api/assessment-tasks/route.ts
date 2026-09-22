import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toAssessmentTask } from "@/lib/adoption-fitness/serialize";
import type { AssessmentTask } from "@/lib/adoption-fitness/types";

export async function GET() {
  const rows = await db.orm.AssessmentTask.where({}).all();
  return NextResponse.json({ items: rows.map(toAssessmentTask) });
}

export async function POST(request: Request) {
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
