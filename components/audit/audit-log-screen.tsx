"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { listAuditLog } from "@/lib/audit/store";
import type { AuditEntityType, AuditLogEntry } from "@/lib/audit/types";
import type { Role } from "@/lib/roles/roles";
import { formatDateTime } from "@/lib/shared/dates";

const ALLOWED_ROLES: Role[] = ["Administrator"];
const ENTITY_TYPES: AuditEntityType[] = [
  "Animal",
  "MedicalRecord",
  "StatutoryHold",
  "IntakeRecord",
  "UserAccount",
  "FollowUpVisit",
  "SystemSetting",
];

function AuditLogContent() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<AuditEntityType | "">("");

  useEffect(() => {
    let cancelled = false;
    listAuditLog()
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Unable to load the Audit Log. Try again.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entityType && entry.entityType !== entityType) return false;
      if (query) {
        const haystack =
          `${entry.action} ${entry.entityId} ${entry.userName} ${entry.userId} ${entry.oldValue} ${entry.newValue}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [entries, search, entityType]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Audit Log</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every significant status change and state-changing action. Entries are permanent -
          nothing here can be edited or deleted.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Recorded: animal status and listing changes, intake, medical clearance, statutory
          holds, adoption fitness confirmations, application decisions, agreements, payments,
          follow-up visits, and user and system settings changes. Suitability check decisions
          appear through the status change they cause; sign-in attempts are not recorded here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="audit-search" className="sr-only">
          Search audit log
        </label>
        <input
          id="audit-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by action, entity ID or user"
          className="h-10 min-w-[220px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <select
          aria-label="Filter by entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value as AuditEntityType | "")}
          className="h-10 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Loading Audit Log...
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-[12px] border border-danger bg-danger/10 p-6 text-center">
          <p className="text-sm font-semibold text-text">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            className="mt-2 h-9 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-active"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">
            {entries.length === 0
              ? "No audit entries have been recorded yet."
              : "No audit entries match your filters."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((entry) => (
            <li
              key={entry.auditId}
              className="rounded-[12px] border border-border bg-surface p-4 text-sm shadow-[0_2px_8px_rgba(200,182,173,0.2)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-text">{entry.action}</span>
                <span className="text-xs text-text-muted">{formatDateTime(entry.timestamp)}</span>
              </div>
              <p className="mt-1 text-text-muted">
                {entry.entityType} &middot; {entry.entityId}
              </p>
              {entry.oldValue && (
                <p className="mt-1 text-xs text-text-muted">From: {entry.oldValue}</p>
              )}
              <p className="text-xs text-text-muted">To: {entry.newValue}</p>
              <p className="mt-1 text-xs text-text-muted">
                By {entry.userName} ({entry.userId})
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AuditLogScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AuditLogContent />
    </AppShell>
  );
}
