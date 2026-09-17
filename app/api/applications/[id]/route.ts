import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionApplication, toApplicationRowPatch } from "@/lib/applications/serialize";
import type { AdoptionApplication } from "@/lib/applications/types";

// Generic patch - mirrors Animal's/StatutoryHold's PATCH routes. Every
// call site (updateDraft, submitApplication, markUnderReview,
// approveApplication, rejectApplication, closeApplicationIncompatible,
// resumeApplication, markFinalised) just patches a different subset of
// fields; business-rule checks (not_draft, blocked, not_on_hold, ...)
// stay client-side in lib/applications/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<AdoptionApplication>;

  const updated = await db.orm.AdoptionApplication.where({ applicationId: id }).update(
    toApplicationRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toAdoptionApplication(updated) });
}
