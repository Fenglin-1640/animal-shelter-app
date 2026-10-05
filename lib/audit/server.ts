import type { AuditEntityType } from "@/lib/audit/types";
import { toTimestamptz } from "@/lib/db/temporal";

// AuditLog rows written by API routes themselves, so a server-side change
// and its audit entry can commit in the same transaction. Same shape and
// id format as lib/audit/store.ts's writeAuditLog().
export function auditRow(entry: {
  actor: { email: string; name: string };
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  oldValue: string;
  newValue: string;
}) {
  return {
    auditId: `AUD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    userId: entry.actor.email,
    userName: entry.actor.name,
    timestamp: toTimestamptz(new Date().toISOString()),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    result: "Success",
  };
}
