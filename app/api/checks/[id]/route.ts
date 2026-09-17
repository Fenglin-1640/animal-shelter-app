import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toSuitabilityCheck } from "@/lib/checks/serialize";

// completeCheck(): records a Pass/Concern/Fail outcome for one check.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    outcome: string;
    checkNotes: string;
    conductedDate: string;
    completedByEmail: string;
    completedByName: string;
  };

  const updated = await db.orm.SuitabilityCheck.where({ checkId: id }).update({
    outcome: body.outcome,
    checkNotes: body.checkNotes,
    conductedDate: body.conductedDate,
    completedByEmail: body.completedByEmail,
    completedByName: body.completedByName,
  });
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toSuitabilityCheck(updated) });
}
