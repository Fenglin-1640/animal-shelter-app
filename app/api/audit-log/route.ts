import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAuditLogEntry } from "@/lib/audit/serialize";
import type { AuditLogEntry } from "@/lib/audit/types";

// No PATCH or DELETE handler in this route, and none in
// lib/audit/store.ts either - BR-013's "应用界面不提供修改或删除 AuditLog 的功能"
// (immutable, no update/delete from the UI) is enforced by simply never
// exposing those operations, not by a database-level constraint.

export async function GET() {
  const rows = await db.orm.AuditLogEntry.where({}).all();
  return NextResponse.json({ items: rows.map(toAuditLogEntry) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as AuditLogEntry;
  const created = await db.orm.AuditLogEntry.create({
    auditId: body.auditId,
    userId: body.userId,
    userName: body.userName,
    timestamp: new Date(body.timestamp),
    action: body.action,
    entityType: body.entityType,
    entityId: body.entityId,
    oldValue: body.oldValue,
    newValue: body.newValue,
    result: body.result,
  });
  return NextResponse.json({ ok: true, item: toAuditLogEntry(created) });
}
