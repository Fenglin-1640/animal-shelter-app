import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionApplication, toApplicationRowPatch } from "@/lib/applications/serialize";
import type { AdoptionApplication } from "@/lib/applications/types";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ADOPTER, isOwnRecord, STAFF } from "@/lib/auth/api-roles";

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
  const auth = await requireRole([...STAFF, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<AdoptionApplication>;
  // Documents are added and removed only through /api/files, which keeps
  // this list in step with the stored files.
  delete patch.documents;
  if (auth.role === "Adopter") {
    // An Adopter may only edit - and submit - their own Draft application;
    // every later status change is a Staff decision.
    const existing = await db.orm.AdoptionApplication.where({ applicationId: id }).first();
    if (!existing || !isOwnRecord(auth, existing.adopterEmail) || existing.applicationStatus !== "Draft") return forbidden();
    if (patch.adopterEmail !== undefined && !isOwnRecord(auth, patch.adopterEmail)) return forbidden();
  }

  const updated = await db.orm.AdoptionApplication.where({ applicationId: id }).update(
    toApplicationRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toAdoptionApplication(updated) });
}
