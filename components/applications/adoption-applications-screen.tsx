"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { NeedsActionLabel } from "@/components/process/needs-action-label";
import { StatusChip } from "@/components/shared/status-chip";
import { ensureWorklist, useWorklist } from "@/lib/process/worklist-client";
import { useAuth } from "@/lib/auth/auth-context";
import { listAllApplications } from "@/lib/applications/store";
import { APPLICATION_STATUS_CATEGORY } from "@/lib/applications/status";
import type { AdoptionApplication, ApplicationStatus } from "@/lib/applications/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function AdoptionApplicationsContent() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");

  const [applications, setApplications] = useState<AdoptionApplication[]>([]);
  const worklist = useWorklist();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listAllApplications()
      .then((result) => {
        if (cancelled) return;
        setApplications(result);
        ensureWorklist();
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Unable to load applications. Try again.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const availableStatuses = useMemo(
    () => Array.from(new Set(applications.map((a) => a.applicationStatus))),
    [applications],
  );

  // Applications that need the viewer's action come first (server-ranked,
  // /api/worklist).
  const priority = (id: string) => worklist?.applications[id]?.priority ?? 1;
  const filtered = applications.filter((a) => {
    if (a.applicationStatus === "Draft") return false;
    const query = search.trim().toLowerCase();
    if (query) {
      const haystack = `${a.animalName} ${a.adopterName} ${a.applicationId}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (statusFilter && a.applicationStatus !== statusFilter) return false;
    return true;
  }).sort((a, b) => priority(a.applicationId) - priority(b.applicationId));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Adoption Applications</h1>
        <p className="mt-1 text-sm text-text-muted">
          Run suitability checks and decide application outcomes.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="applications-search" className="sr-only">
          Search applications
        </label>
        <input
          id="applications-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by animal, adopter or application ID"
          className="h-10 min-w-[220px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "")}
          className="h-10 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <option value="">All statuses</option>
          {availableStatuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Loading applications...
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
          <p className="text-sm font-semibold text-text">No submitted applications match.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((a) => (
            <li key={a.applicationId}>
              <Link
                href={`/adoption-applications/${a.applicationId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] hover:bg-surface-active"
              >
                <div>
                  <p className="text-sm font-semibold text-text">
                    {a.animalName} &middot; {a.adopterName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {a.applicationId}
                    {a.submissionDate ? ` · Submitted ${formatDate(a.submissionDate)}` : ""}
                  </p>
                  {worklist?.applications[a.applicationId]?.needsMyAction && (
                    <NeedsActionLabel label={worklist.applications[a.applicationId].nextAction} />
                  )}
                </div>
                <StatusChip
                  label={a.applicationStatus}
                  category={APPLICATION_STATUS_CATEGORY[a.applicationStatus]}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdoptionApplicationsScreen() {
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
      <AdoptionApplicationsContent />
    </AppShell>
  );
}
