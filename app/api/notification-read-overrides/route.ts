import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  toNotificationReadOverride,
  toNotificationReadOverrideRow,
  type NotificationReadOverride,
} from "@/lib/notifications/serialize";

export async function GET() {
  const rows = await db.orm.NotificationReadOverride.where({}).all();
  return NextResponse.json({ items: rows.map(toNotificationReadOverride) });
}

// Upsert, not create - there is exactly one override per (email,
// notificationId) pair, and lib/notifications/read-state-store.ts's
// setReadOverride always submits the complete override wholesale rather
// than a partial patch.
export async function POST(request: Request) {
  const body = (await request.json()) as NotificationReadOverride;
  const row = toNotificationReadOverrideRow(body);
  const saved = await db.orm.NotificationReadOverride.upsert({ create: row, update: row });
  return NextResponse.json({ ok: true, item: toNotificationReadOverride(saved) });
}
