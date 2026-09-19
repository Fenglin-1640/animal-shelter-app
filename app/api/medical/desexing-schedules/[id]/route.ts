import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDesexingSchedule, toDesexingScheduleRowPatch } from "@/lib/medical/serialize";
import type { DesexingSchedule } from "@/lib/medical/types";

// Generic patch - mirrors Photo's PATCH route. Call sites (completeDesexing,
// updateDesexingScheduledDate in lib/medical/store.ts) each patch a
// different subset of fields; business-rule checks (already_completed,
// not_found) stay client-side.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<DesexingSchedule>;

  const updated = await db.orm.DesexingSchedule.where({ id }).update(toDesexingScheduleRowPatch(patch));
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toDesexingSchedule(updated) });
}
