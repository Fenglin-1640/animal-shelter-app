import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toStatutoryHold, toStatutoryHoldRowPatch } from "@/lib/statutory-hold/serialize";
import type { StatutoryHold } from "@/lib/statutory-hold/types";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM } from "@/lib/auth/api-roles";

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
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<StatutoryHold>;

  if (auth.role === "Veterinarian") {
    // Holds are read-only for a Veterinarian (PRD 9); the only write their
    // session makes is the lazy holdPeriodExpired flip that any read of
    // holds performs, so that is all it may do: mark an Active hold whose
    // end date has passed as Expired.
    const existing = await db.orm.StatutoryHold.where({ id }).first();
    const onlyExpiry = Object.keys(patch).every((key) => key === "status" || key === "expiredAt");
    if (
      !existing ||
      !onlyExpiry ||
      patch.status !== "Expired" ||
      existing.status !== "Active" ||
      new Date(existing.holdEndAt) > new Date()
    ) {
      return forbidden();
    }
  }

  const updated = await db.orm.StatutoryHold.where({ id }).update(toStatutoryHoldRowPatch(patch));
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toStatutoryHold(updated) });
}
