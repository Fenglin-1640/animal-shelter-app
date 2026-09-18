import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDropdownOption } from "@/lib/system-administration/serialize";
import type { DropdownOption } from "@/lib/system-administration/types";

export async function GET() {
  const rows = await db.orm.DropdownOption.where({}).all();
  return NextResponse.json({ items: rows.map(toDropdownOption) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as DropdownOption;
  const created = await db.orm.DropdownOption.create({
    id: body.id,
    category: body.category,
    value: body.value,
    description: body.description,
    speciesId: body.speciesId ?? null,
    isRetired: body.isRetired ? 1 : 0,
    systemLocked: body.systemLocked ? 1 : 0,
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toDropdownOption(created) });
}
