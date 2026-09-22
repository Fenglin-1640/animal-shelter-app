import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toMicrochipLookup } from "@/lib/microchip/serialize";
import type { MicrochipLookup } from "@/lib/microchip/types";
import { toTimestamptz } from "@/lib/db/temporal";

// No PATCH or DELETE route, and none in lib/microchip/store.ts either -
// FR-MC-01's "不可删除" (immutable, never edited or deleted once created)
// is enforced by simply never exposing those operations, same pattern
// as app/api/audit-log/route.ts.

export async function GET() {
  const rows = await db.orm.MicrochipLookup.where({}).all();
  return NextResponse.json({ items: rows.map(toMicrochipLookup) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as MicrochipLookup;
  const created = await db.orm.MicrochipLookup.create({
    id: body.id,
    animalId: body.animalId,
    microchipNumber: body.microchipNumber,
    result: body.result,
    ownerContactName: body.ownerContact?.name ?? null,
    ownerContactPhone: body.ownerContact?.phone ?? null,
    ownerContactAddress: body.ownerContact?.address ?? null,
    performedByEmail: body.performedByEmail,
    performedByName: body.performedByName,
    performedAt: toTimestamptz(body.performedAt),
  });
  return NextResponse.json({ ok: true, item: toMicrochipLookup(created) });
}
