"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { listActiveFollowUpVisits } from "@/lib/follow-up-visits/store";
import { FOLLOW_UP_VISIT_STATUS_CATEGORY } from "@/lib/follow-up-visits/status";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function FollowUpVisitsContent() {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => listActiveFollowUpVisits(), []);

  const filtered = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${row.animalName} ${row.adopterName}`.toLowerCase().includes(query);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Follow Up Visits</h1>
        <p className="mt-1 text-sm text-text-muted">
          Track post-release welfare checks for recently released animals.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="follow-up-search" className="sr-only">
          Search visits
        </label>
        <input
          id="follow-up-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by animal or adopter name"
          className="h-10 min-w-[220px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">No Follow-Up Visits are currently scheduled.</p>
          <p className="mt-1 text-sm text-text-muted">
            A visit is scheduled automatically when Shelter Staff release an animal to its Adopter.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((visit) => (
            <li key={visit.followUpVisitId}>
              <Link
                href={`/animals/${visit.animalId}/follow-up-visit`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] hover:bg-surface-active"
              >
                <div>
                  <p className="text-sm font-semibold text-text">
                    {visit.animalName} &middot; {visit.adopterName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {visit.followUpType} due {formatDate(visit.targetDate)} &middot; Assigned to {visit.assignedStaffName}
                  </p>
                </div>
                <StatusChip label={visit.status} category={FOLLOW_UP_VISIT_STATUS_CATEGORY[visit.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FollowUpVisitsQueueScreen() {
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
      <FollowUpVisitsContent />
    </AppShell>
  );
}
