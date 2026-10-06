import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDropdownOption } from "@/lib/system-administration/serialize";
import type { DropdownOption } from "@/lib/system-administration/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { ADMINISTRATOR } from "@/lib/auth/api-roles";
import { auditRow } from "@/lib/audit/server";
import { describeOption, vaccineMetadataColumns } from "@/lib/system-administration/option-server";

// Generic patch - mirrors AdoptionAgreement's/CouncilTransferSubmission's
// PATCH routes. Call sites (updateOption, setRetired) each patch a
// different subset of fields; business-rule checks (not_found,
// duplicate, locked) stay client-side in
// lib/system-administration/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(ADMINISTRATOR);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<DropdownOption>;
  const existing = await db.orm.DropdownOption.where({ id }).first();
  if (!existing) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const meta = await vaccineMetadataColumns(existing.category, patch);
  if ("error" in meta) return meta.error;
  const row: Record<string, unknown> = { ...meta.columns };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "applicableSpecies" || key === "coversAntigens" || key === "id" || key === "category") {
      continue;
    } else if (key === "isRetired" || key === "systemLocked") {
      row[key] = value ? 1 : 0;
    } else if (key === "updatedAt") {
      row[key] = toTimestamptz(value as string);
    } else if (key === "speciesId") {
      row[key] = value ?? null;
    } else {
      row[key] = value;
    }
  }

  // Audited in the same transaction. Existing records that use the
  // option (e.g. vaccinations) are not changed.
  const updated = await db.transaction(async (orm) => {
    const saved = await orm.DropdownOption.where({ id }).update(row);
    if (saved) {
      await orm.AuditLogEntry.create(
        auditRow({
          actor: { email: auth.email, name: auth.displayName },
          action: "isRetired" in patch && Object.keys(patch).every((k) => k === "isRetired" || k === "updatedAt") ? (patch.isRetired ? "Retire Dropdown Option" : "Restore Dropdown Option") : "Update Dropdown Option",
          entityType: "SystemSetting",
          entityId: id,
          oldValue: describeOption(toDropdownOption(existing)),
          newValue: describeOption(toDropdownOption(saved)),
        }),
      );
    }
    return saved;
  });
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toDropdownOption(updated) });
}
