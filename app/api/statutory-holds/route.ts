import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toStatutoryHold } from "@/lib/statutory-hold/serialize";
import type { StatutoryHold } from "@/lib/statutory-hold/types";

export async function GET() {
  const rows = await db.orm.StatutoryHold.where({}).all();
  return NextResponse.json({ items: rows.map(toStatutoryHold) });
}

// FR-MC-02 steps 1-3, run automatically as a consequence of Scan
// Microchip (FR-MC-01) returning Owner Match.
export async function POST(request: Request) {
  const body = (await request.json()) as StatutoryHold;
  const created = await db.orm.StatutoryHold.create({
    id: body.id,
    animalId: body.animalId,
    ownerContactName: body.ownerContact.name,
    ownerContactPhone: body.ownerContact.phone,
    ownerContactAddress: body.ownerContact.address,
    holdStartAt: new Date(body.holdStartAt),
    holdEndAt: new Date(body.holdEndAt),
    holdingPeriodDays: body.holdingPeriodDays,
    status: body.status,
    createdAt: new Date(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toStatutoryHold(created) });
}
