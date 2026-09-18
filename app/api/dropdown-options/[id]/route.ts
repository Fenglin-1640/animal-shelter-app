import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDropdownOption } from "@/lib/system-administration/serialize";
import type { DropdownOption } from "@/lib/system-administration/types";

// Generic patch - mirrors AdoptionAgreement's/CouncilTransferSubmission's
// PATCH routes. Call sites (updateOption, setRetired) each patch a
// different subset of fields; business-rule checks (not_found,
// duplicate, locked) stay client-side in
// lib/system-administration/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<DropdownOption>;
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "isRetired" || key === "systemLocked") {
      row[key] = value ? 1 : 0;
    } else if (key === "updatedAt") {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else if (key === "speciesId") {
      row[key] = value ?? null;
    } else {
      row[key] = value;
    }
  }

  const updated = await db.orm.DropdownOption.where({ id }).update(row);
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toDropdownOption(updated) });
}
