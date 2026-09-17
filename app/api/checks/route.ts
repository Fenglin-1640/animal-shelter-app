import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toSuitabilityCheck } from "@/lib/checks/serialize";
import type { SuitabilityCheck } from "@/lib/checks/types";

export async function GET() {
  const rows = await db.orm.SuitabilityCheck.where({}).all();
  return NextResponse.json({ items: rows.map(toSuitabilityCheck) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as SuitabilityCheck;
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
