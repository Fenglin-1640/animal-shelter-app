import type { AuditEntityType, AuditLogEntry } from "@/lib/audit/types";

// FR-AUD-01: immutable AuditLog now lives in the database (see
// prisma/contract.prisma) behind /api/audit-log - see prisma/README.md
// for this Prisma toolchain's quirks. "应用界面不提供修改或删除 AuditLog 的功能" -
// this module still exposes no update or delete function, only append
// (write) and read (list); that immutability guarantee doesn't change
// by moving off localStorage, since it was always enforced by this
// module's API surface, not by the storage layer.

function generateAuditId(): string {
  return `AUD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function writeAuditLog(entry: Omit<AuditLogEntry, "auditId" | "timestamp">): Promise<void> {
  const full: AuditLogEntry = {
    ...entry,
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
  };
  await fetch("/api/audit-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(full),
  });
}

export async function listAuditLog(): Promise<AuditLogEntry[]> {
  const response = await fetch("/api/audit-log");
  const result = await response.json();
  const items = result.items as AuditLogEntry[];
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function listAuditLogForEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLogEntry[]> {
  return (await listAuditLog()).filter((e) => e.entityType === entityType && e.entityId === entityId);
}
