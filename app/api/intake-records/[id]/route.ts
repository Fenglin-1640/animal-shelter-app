import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toIntakeRecord, toIntakeRecordRowPatch } from "@/lib/intake-records/serialize";
import type { IntakeRecord } from "@/lib/intake-records/types";
import { requireRole } from "@/lib/auth/server-session";
import { STAFF } from "@/lib/auth/api-roles";

// The full record, including intake photos' imageData (which the list
// endpoint leaves out).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const row = await db.orm.IntakeRecord.where({ intakeId: id }).first();
  if (!row) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toIntakeRecord(row) });
}

// Generic patch - mirrors CouncilTransferSubmission's PATCH route. Call
// sites (updateIntakeRecord, finaliseIntake, linkRegisteredOwnerContact)
// each patch a different subset of fields; business-rule checks
// (not_found, already_finalised, blocked) stay client-side in
// lib/intake-records/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<IntakeRecord>;

  const updated = await db.orm.IntakeRecord.where({ intakeId: id }).update(
    toIntakeRecordRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toIntakeRecord(updated) });
}
