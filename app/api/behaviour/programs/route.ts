import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toBehaviourProgram } from "@/lib/behaviour/serialize";
import type { BehaviourProgram } from "@/lib/behaviour/types";

export async function GET() {
  const rows = await db.orm.BehaviourProgram.where({}).all();
  return NextResponse.json({ items: rows.map(toBehaviourProgram) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as BehaviourProgram;
  const created = await db.orm.BehaviourProgram.create({
    id: body.id,
    animalId: body.animalId,
    triggeringAssessmentId: body.triggeringAssessmentId,
    status: body.status,
    createdAt: new Date(body.createdAt),
    resolvedAt: body.resolvedAt ? new Date(body.resolvedAt) : null,
  });
  return NextResponse.json({ ok: true, item: toBehaviourProgram(created) });
}
