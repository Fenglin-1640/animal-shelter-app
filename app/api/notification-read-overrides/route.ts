import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { ALL_ROLES, isOwnRecord } from "@/lib/auth/api-roles";
import {
  toNotificationReadOverride,
  toNotificationReadOverrideRow,
  type NotificationReadOverride,
} from "@/lib/notifications/serialize";

export async function GET() {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  // Read state is per account - return only the signed-in user's.
  const rows = await db.orm.NotificationReadOverride.where({}).all();
  const items = rows.map(toNotificationReadOverride).filter((item) => isOwnRecord(auth, item.email));
  return NextResponse.json({ items });
}

// Upsert, not create - there is exactly one override per (email,
// notificationId) pair, and lib/notifications/read-state-store.ts's
// setReadOverride always submits the complete override wholesale rather
// than a partial patch.
export async function POST(request: Request) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as NotificationReadOverride;
  if (!isOwnRecord(auth, body.email)) return forbidden();
  const row = toNotificationReadOverrideRow(body);
  const saved = await db.orm.NotificationReadOverride.upsert({ create: row, update: row });
  return NextResponse.json({ ok: true, item: toNotificationReadOverride(saved) });
}
