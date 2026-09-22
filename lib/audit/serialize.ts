import type { AuditEntityType, AuditLogEntry } from "@/lib/audit/types";

export interface AuditLogEntryRow extends Omit<AuditLogEntry, "timestamp" | "entityType" | "result"> {
  timestamp: string;
  entityType: string;
  result: string;
}

export function toAuditLogEntry(row: AuditLogEntryRow): AuditLogEntry {
  return {
    ...row,
    timestamp: row.timestamp,
    entityType: row.entityType as AuditEntityType,
    result: row.result as AuditLogEntry["result"],
  };
}
