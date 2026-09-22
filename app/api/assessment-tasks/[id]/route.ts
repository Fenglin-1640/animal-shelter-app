import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAssessmentTask } from "@/lib/adoption-fitness/serialize";
import type { AssessmentTask } from "@/lib/adoption-fitness/types";
import { toTimestamptz } from "@/lib/db/temporal";

// Generic patch - mirrors CouncilTransferSubmission's/DropdownOption's
// PATCH routes. The only call site today (markTaskContinuable) just
// patches status/markedBy*/markedAt; the not_found check stays
// client-side in lib/adoption-fitness/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<AssessmentTask>;
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "markedAt") {
      row[key] = toTimestamptz(value as string | null);
    } else {
      row[key] = value;
    }
  }

  const updated = await db.orm.AssessmentTask.where({ id }).update(row);
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toAssessmentTask(updated) });
}
