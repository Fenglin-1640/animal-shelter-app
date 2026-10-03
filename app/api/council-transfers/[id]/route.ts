import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toCouncilTransferSubmission, toTransferRowPatch } from "@/lib/council-transfers/serialize";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { COUNCIL_OFFICER, isOwnRecord, STAFF } from "@/lib/auth/api-roles";

// Generic patch - mirrors AdoptionApplication's/FollowUpVisit's PATCH
// routes. Call sites (updateDraft, submitTransfer, acceptTransfer) each
// patch a different subset of fields; business-rule checks (not_found,
// not_editable, missing_fields, missing_attachment) stay client-side
// in lib/council-transfers/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole([...STAFF, ...COUNCIL_OFFICER]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<CouncilTransferSubmission>;
  if (auth.role === "Council Animal Control Officer") {
    // A Council Officer may only edit - and submit - their own Draft;
    // accepting a transfer is a Staff action.
    const existing = await db.orm.CouncilTransferSubmission.where({ id }).first();
    if (!existing || !isOwnRecord(auth, existing.submittedByEmail) || existing.status !== "Draft") return forbidden();
    if (patch.submittedByEmail !== undefined && !isOwnRecord(auth, patch.submittedByEmail)) return forbidden();
  }

  const updated = await db.orm.CouncilTransferSubmission.where({ id }).update(
    toTransferRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toCouncilTransferSubmission(updated) });
}
