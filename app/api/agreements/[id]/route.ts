import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionAgreement, toAgreementRowPatch } from "@/lib/agreements/serialize";
import type { AdoptionAgreement } from "@/lib/agreements/types";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ADOPTER, isOwnRecord, STAFF } from "@/lib/auth/api-roles";

// Generic patch - mirrors AdoptionApplication's/MeetAndGreet's PATCH
// routes. The only call site today (signAgreement) just patches
// isSigned/signedDate/updatedAt; business-rule checks (not_found,
// already_signed) stay client-side in lib/agreements/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole([...STAFF, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<AdoptionAgreement>;
  if (auth.role === "Adopter") {
    // An Adopter may only sign their own agreement.
    const existing = await db.orm.AdoptionAgreement.where({ agreementId: id }).first();
    if (!existing || !isOwnRecord(auth, existing.adopterEmail)) return forbidden();
    if (patch.adopterEmail !== undefined && !isOwnRecord(auth, patch.adopterEmail)) return forbidden();
  }

  const updated = await db.orm.AdoptionAgreement.where({ agreementId: id }).update(
    toAgreementRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toAdoptionAgreement(updated) });
}
