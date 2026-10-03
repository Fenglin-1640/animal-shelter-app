import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toAuditLogEntry } from "@/lib/audit/serialize";
import type { AuditLogEntry } from "@/lib/audit/types";
import { requireRole } from "@/lib/auth/server-session";
import { ADMINISTRATOR, ALL_ROLES } from "@/lib/auth/api-roles";

// No PATCH or DELETE handler in this route, and none in
// lib/audit/store.ts either - BR-013's "应用界面不提供修改或删除 AuditLog 的功能"
// (immutable, no update/delete from the UI) is enforced by simply never
// exposing those operations, not by a database-level constraint.

export async function GET() {
  const auth = await requireRole(ADMINISTRATOR);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.AuditLogEntry.where({}).all();
  return NextResponse.json({ items: rows.map(toAuditLogEntry) });
}

export async function POST(request: Request) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as AuditLogEntry;
  const created = await db.orm.AuditLogEntry.create({
    auditId: body.auditId,
    userId: body.userId,
    userName: body.userName,
    timestamp: toTimestamptz(body.timestamp),
    action: body.action,
    entityType: body.entityType,
    entityId: body.entityId,
    oldValue: body.oldValue,
    newValue: body.newValue,
    result: body.result,
  });
  return NextResponse.json({ ok: true, item: toAuditLogEntry(created) });
}
