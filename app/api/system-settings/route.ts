import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toSystemSettings } from "@/lib/system-administration/serialize";
import type { SystemSettings } from "@/lib/system-administration/settings-types";

const SETTINGS_ID = "system-settings";

export async function GET() {
  const row = await db.orm.SystemSettings.where({ id: SETTINGS_ID }).first();
  return NextResponse.json({ item: row ? toSystemSettings(row) : null });
}

// Upsert, not create - there is exactly one SystemSettings row for the
// whole shelter, and the form always submits the complete record
// wholesale rather than a partial patch, same reasoning as
// AdopterProfile's single GET (list-of-one, singleton by fixed id
// here rather than by email) + POST (upsert) pair.
export async function POST(request: Request) {
  const body = (await request.json()) as SystemSettings;
  const row = {
    id: SETTINGS_ID,
    holdingPeriodDays: body.holdingPeriodDays,
    reminderLeadDays: body.reminderLeadDays,
    allowedAttachmentTypes: JSON.stringify(body.allowedAttachmentTypes),
    maxAttachmentSizeMB: body.maxAttachmentSizeMB,
    agreementTemplateVersion: body.agreementTemplateVersion,
  };
  const saved = await db.orm.SystemSettings.upsert({ create: row, update: row });
  return NextResponse.json({ ok: true, item: toSystemSettings(saved) });
}
