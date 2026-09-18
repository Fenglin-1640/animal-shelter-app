import type { AuditEntityType, AuditLogEntry } from "@/lib/audit/types";

export interface AuditLogEntryRow extends Omit<AuditLogEntry, "timestamp" | "entityType" | "result"> {
  timestamp: Date;
  entityType: string;
  result: string;
}

export function toAuditLogEntry(row: AuditLogEntryRow): AuditLogEntry {
  return {
    ...row,
    timestamp: row.timestamp.toISOString(),
    entityType: row.entityType as AuditEntityType,
    result: row.result as AuditLogEntry["result"],
  };
}
