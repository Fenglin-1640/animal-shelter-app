import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionPayment, toPaymentRowPatch } from "@/lib/payments/serialize";
import type { AdoptionPayment } from "@/lib/payments/types";
import { requireRole } from "@/lib/auth/server-session";
import { STAFF } from "@/lib/auth/api-roles";

// Generic patch - mirrors AdoptionAgreement's PATCH route. The only
// call site today (verifyPayment) just patches
// paymentStatus/receiptNumber/verifiedBy*/failureReason/updatedAt;
// business-rule checks (not_found, not_pending, reason_required) stay
// client-side in lib/payments/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<AdoptionPayment>;

  const updated = await db.orm.AdoptionPayment.where({ paymentId: id }).update(
    toPaymentRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toAdoptionPayment(updated) });
}
