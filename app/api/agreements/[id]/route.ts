import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAdoptionAgreement, toAgreementRowPatch } from "@/lib/agreements/serialize";
import type { AdoptionAgreement } from "@/lib/agreements/types";

// Generic patch - mirrors AdoptionApplication's/MeetAndGreet's PATCH
// routes. The only call site today (signAgreement) just patches
// isSigned/signedDate/updatedAt; business-rule checks (not_found,
// already_signed) stay client-side in lib/agreements/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<AdoptionAgreement>;

  const updated = await db.orm.AdoptionAgreement.where({ agreementId: id }).update(
    toAgreementRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toAdoptionAgreement(updated) });
}
