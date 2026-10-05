import { NextResponse } from "next/server";
import { invalidateVetConfirmation } from "@/lib/adoption-fitness/server";
import { db } from "@/lib/db/client";
import { toStatutoryHold } from "@/lib/statutory-hold/serialize";
import type { StatutoryHold } from "@/lib/statutory-hold/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, STAFF } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.StatutoryHold.where({}).all();
  return NextResponse.json({ items: rows.map(toStatutoryHold) });
}

// FR-MC-02 steps 1-3, run automatically as a consequence of Scan
// Microchip (FR-MC-01) returning Owner Match.
export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as StatutoryHold;
  // A new unresolved hold also withdraws the automatic Veterinarian
  // fitness confirmation (same transaction, audited), so the animal can't
  // keep Pre-Listing eligibility - or be published - on a stale
  // confirmation; the Vet re-confirms by issuing the clearance again.
  const created = await db.transaction(async (orm) => {
    const hold = await orm.StatutoryHold.create({
    id: body.id,
    animalId: body.animalId,
    ownerContactName: body.ownerContact.name,
    ownerContactPhone: body.ownerContact.phone,
    ownerContactAddress: body.ownerContact.address,
    holdStartAt: toTimestamptz(body.holdStartAt),
    holdEndAt: toTimestamptz(body.holdEndAt),
    holdingPeriodDays: body.holdingPeriodDays,
    status: body.status,
    createdAt: toTimestamptz(body.createdAt),
    });
    if (body.status === "Active") {
      await invalidateVetConfirmation(orm, body.animalId, { email: auth.email, name: auth.displayName }, "an unresolved Statutory Hold was created");
    }
    return hold;
  });
  return NextResponse.json({ ok: true, item: toStatutoryHold(created) });
}
