import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toBehaviourProgram } from "@/lib/behaviour/serialize";
import type { BehaviourProgram } from "@/lib/behaviour/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, STAFF } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.BehaviourProgram.where({}).all();
  return NextResponse.json({ items: rows.map(toBehaviourProgram) });
}

export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as BehaviourProgram;
  const created = await db.orm.BehaviourProgram.create({
    id: body.id,
    animalId: body.animalId,
    triggeringAssessmentId: body.triggeringAssessmentId,
    status: body.status,
    createdAt: toTimestamptz(body.createdAt),
    resolvedAt: toTimestamptz(body.resolvedAt ?? null),
  });
  return NextResponse.json({ ok: true, item: toBehaviourProgram(created) });
}
