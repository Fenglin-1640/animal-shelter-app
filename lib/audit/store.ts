import type { AuditEntityType, AuditLogEntry } from "@/lib/audit/types";

// FR-AUD-01: immutable AuditLog, persisted to localStorage since there is
// no backend. "应用界面不提供修改或删除 AuditLog 的功能" - this module exposes no
// update or delete function, only append (write) and read (list).
const STORAGE_KEY = "asams-audit-log";

function loadAll(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveAll(entries: AuditLogEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function generateAuditId(): string {
  return `AUD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function writeAuditLog(entry: Omit<AuditLogEntry, "auditId" | "timestamp">) {
  const full: AuditLogEntry = {
    ...entry,
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
  };
  saveAll([...loadAll(), full]);
}

export function listAuditLog(): AuditLogEntry[] {
  return loadAll().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function listAuditLogForEntity(entityType: AuditEntityType, entityId: string): AuditLogEntry[] {
  return listAuditLog().filter((e) => e.entityType === entityType && e.entityId === entityId);
}
