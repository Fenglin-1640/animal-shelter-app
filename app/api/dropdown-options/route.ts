import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDropdownOption } from "@/lib/system-administration/serialize";
import type { DropdownOption } from "@/lib/system-administration/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { ADMINISTRATOR } from "@/lib/auth/api-roles";

export async function GET() {
  const rows = await db.orm.DropdownOption.where({}).all();
  return NextResponse.json({ items: rows.map(toDropdownOption) });
}

export async function POST(request: Request) {
  const auth = await requireRole(ADMINISTRATOR);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as DropdownOption;
  const created = await db.orm.DropdownOption.create({
    id: body.id,
    category: body.category,
    value: body.value,
    description: body.description,
    speciesId: body.speciesId ?? null,
    isRetired: body.isRetired ? 1 : 0,
    systemLocked: body.systemLocked ? 1 : 0,
    createdAt: toTimestamptz(body.createdAt),
    updatedAt: toTimestamptz(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toDropdownOption(created) });
}
