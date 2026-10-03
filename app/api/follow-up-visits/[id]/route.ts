import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toFollowUpVisit, toFollowUpVisitRowPatch } from "@/lib/follow-up-visits/serialize";
import type { FollowUpVisit } from "@/lib/follow-up-visits/types";
import { requireRole } from "@/lib/auth/server-session";
import { STAFF } from "@/lib/auth/api-roles";

// Generic patch - mirrors AdoptionAgreement's/AdoptionPayment's PATCH
// routes. The only call site today (completeFollowUpVisit) just
// patches status/outcome/outcomeNotes/completedBy*/completedAt;
// business-rule checks (not_found, already_completed) stay
// client-side in lib/follow-up-visits/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<FollowUpVisit>;

  const updated = await db.orm.FollowUpVisit.where({ followUpVisitId: id }).update(
    toFollowUpVisitRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toFollowUpVisit(updated) });
}
