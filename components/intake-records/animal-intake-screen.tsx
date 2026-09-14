"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { IntakeRecordCard } from "@/components/intake-records/intake-record-card";
import { useAuth } from "@/lib/auth/auth-context";
import { listSubmittedTransfers } from "@/lib/council-transfers/store";
import { listIntakeRecords, listLinkedTransferIds } from "@/lib/intake-records/store";
import { isIntakeRecordComplete } from "@/lib/intake-records/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];
type CompletenessFilter = "" | "Complete" | "Incomplete";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function AnimalIntakeContent() {
  const [search, setSearch] = useState("");
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>("");

  const linkedTransferIds = useMemo(() => listLinkedTransferIds(), []);
  const pendingTransfers = useMemo(
    () => listSubmittedTransfers().filter((t) => !linkedTransferIds.has(t.id)),
    [linkedTransferIds],
  );
  const intakeRecords = useMemo(() => listIntakeRecords(), []);

  const filteredRecords = intakeRecords
    .filter((r) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const haystack = `${r.species} ${r.intakeSource} ${r.surrenderingPartyName} ${r.arrivalCircumstance}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      const complete = isIntakeRecordComplete(r);
      if (completenessFilter === "Complete" && !complete) return false;
      if (completenessFilter === "Incomplete" && complete) return false;
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">Animal Intake</h1>
            <p className="mt-1 text-sm text-text-muted">
              Review pending Council Transfers and manage formal Intake
              Records.
            </p>
          </div>
          <Link
            href="/intake-records/new"
            className="inline-flex h-10 items-center rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
          >
            New Intake Record
          </Link>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-text">
            Pending Council Transfers ({pendingTransfers.length})
          </h2>
          {pendingTransfers.length === 0 ? (
            <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
              <p className="text-sm font-semibold text-text">
                No submitted Council Transfers are waiting to be reviewed.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingTransfers.map((t) => (
                <article
                  key={t.id}
                  className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] sm:flex-row sm:items-start"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3 className="text-base font-semibold text-text">{t.foundLocation}</h3>
                    <p className="text-xs text-text-muted">
                      {t.id} &middot; Submitted by {t.submittedByName}
                      {t.submissionDate ? ` on ${formatDate(t.submissionDate)}` : ""}
                    </p>
                    <p className="text-sm text-text">{t.animalDescription}</p>
                    <p className="text-sm text-text-muted">
                      {t.attachments.length} attachment{t.attachments.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-start sm:items-center">
                    <Link
                      href={`/intake-records/new?transferId=${encodeURIComponent(t.id)}`}
                      className="inline-flex h-9 items-center whitespace-nowrap rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
                    >
                      Create Intake Record
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-text">
            Intake Records ({intakeRecords.length})
          </h2>

          {intakeRecords.length === 0 ? (
            <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
              <p className="text-sm font-semibold text-text">
                No Intake Records have been created yet.
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Create one from a pending Council Transfer above, or start a
                new one directly.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="intake-search" className="sr-only">
                  Search intake records
                </label>
                <input
                  id="intake-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by species, source or circumstance"
                  className="h-10 min-w-[200px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
                <select
                  aria-label="Filter by completeness"
                  value={completenessFilter}
                  onChange={(e) => setCompletenessFilter(e.target.value as CompletenessFilter)}
                  className="h-10 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <option value="">All</option>
                  <option value="Complete">Complete</option>
                  <option value="Incomplete">Incomplete</option>
                </select>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
                  <p className="text-sm font-semibold text-text">
                    No intake records match your filters.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredRecords.map((record) => (
                    <IntakeRecordCard key={record.intakeId} record={record} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export function AnimalIntakeScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return <AnimalIntakeContent />;
}
