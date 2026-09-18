import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toCouncilTransferSubmission, toTransferRowPatch } from "@/lib/council-transfers/serialize";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";

// Generic patch - mirrors AdoptionApplication's/FollowUpVisit's PATCH
// routes. Call sites (updateDraft, submitTransfer, acceptTransfer) each
// patch a different subset of fields; business-rule checks (not_found,
// not_editable, missing_fields, missing_attachment) stay client-side
// in lib/council-transfers/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<CouncilTransferSubmission>;

  const updated = await db.orm.CouncilTransferSubmission.where({ id }).update(
    toTransferRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toCouncilTransferSubmission(updated) });
}
