import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDropdownOption } from "@/lib/system-administration/serialize";
import type { DropdownOption } from "@/lib/system-administration/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { ADMINISTRATOR } from "@/lib/auth/api-roles";
import { auditRow } from "@/lib/audit/server";
import { describeOption, vaccineMetadataColumns } from "@/lib/system-administration/option-server";

export async function GET() {
  const rows = await db.orm.DropdownOption.where({}).all();
  return NextResponse.json({ items: rows.map(toDropdownOption) });
}

// Creates an option (Administrator), validated and audited in the same
// transaction. Vaccine Type options may carry applicable species and
// covered antigens.
export async function POST(request: Request) {
  const auth = await requireRole(ADMINISTRATOR);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as DropdownOption;
  const meta = await vaccineMetadataColumns(body.category, body);
  if ("error" in meta) return meta.error;
  const created = await db.transaction(async (orm) => {
    const saved = await orm.DropdownOption.create({
      id: body.id,
      category: body.category,
      value: body.value,
      description: body.description,
      speciesId: body.speciesId ?? null,
      isRetired: body.isRetired ? 1 : 0,
      systemLocked: body.systemLocked ? 1 : 0,
      createdAt: toTimestamptz(body.createdAt),
      updatedAt: toTimestamptz(body.updatedAt),
      applicableSpecies: meta.columns.applicableSpecies ?? null,
      coversAntigens: meta.columns.coversAntigens ?? null,
    });
    const item = toDropdownOption(saved);
    await orm.AuditLogEntry.create(
      auditRow({ actor: { email: auth.email, name: auth.displayName }, action: "Create Dropdown Option", entityType: "SystemSetting", entityId: item.id, oldValue: "", newValue: `category=${item.category}; ${describeOption(item)}` }),
    );
    return saved;
  });
  return NextResponse.json({ ok: true, item: toDropdownOption(created) });
}
