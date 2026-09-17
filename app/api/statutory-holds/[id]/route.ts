import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toStatutoryHold, toStatutoryHoldRowPatch } from "@/lib/statutory-hold/serialize";
import type { StatutoryHold } from "@/lib/statutory-hold/types";

// Generic patch - mirrors updateAnimal's PATCH route. Used for
// holdPeriodExpired (status/expiredAt), ownerReclaimed
// (status/reclaimedAt/reclaimedByEmail/reclaimedByName), and completed
// custody transfer (custodyTransferCompletedAt/By). Business-rule checks
// (not_found, invalid_state) stay client-side in
// lib/statutory-hold/store.ts, same reasoning as Animal's and Medical's
// generic PATCH routes.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<StatutoryHold>;

  const updated = await db.orm.StatutoryHold.where({ id }).update(toStatutoryHoldRowPatch(patch));
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toStatutoryHold(updated) });
}
