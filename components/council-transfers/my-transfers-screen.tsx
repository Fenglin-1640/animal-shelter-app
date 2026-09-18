"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { FilterGroup, FilterPanel, type ActiveFilterChip } from "@/components/layout/filter-panel";
import { TransferCard } from "@/components/council-transfers/transfer-card";
import { useAuth } from "@/lib/auth/auth-context";
import { listMyTransfers } from "@/lib/council-transfers/store";
import type { CouncilTransferSubmission, TransferStatus } from "@/lib/council-transfers/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Council Animal Control Officer"];
const PAGE_SIZE = 5;
type SortOrder = "newest" | "oldest";

function FiltersBody({
  availableStatuses,
  statusSelection,
  sortOrder,
  onToggleStatus,
  onSortChange,
  onClearAll,
}: {
  availableStatuses: TransferStatus[];
  statusSelection: Set<TransferStatus>;
  sortOrder: SortOrder;
  onToggleStatus: (value: TransferStatus) => void;
  onSortChange: (value: SortOrder) => void;
  onClearAll: () => void;
}) {
  const chips: ActiveFilterChip[] = Array.from(statusSelection).map((value) => ({
    key: `status-${value}`,
    label: value,
    onRemove: () => onToggleStatus(value),
  }));

  return (
    <FilterPanel activeChips={chips} onClearAll={onClearAll}>
      <FilterGroup heading="Status">
        {availableStatuses.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={statusSelection.has(value)}
              onChange={() => onToggleStatus(value)}
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            {value}
          </label>
        ))}
      </FilterGroup>

      <FilterGroup heading="Sort">
        <select
          value={sortOrder}
          onChange={(event) => onSortChange(event.target.value as SortOrder)}
          className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </FilterGroup>
    </FilterPanel>
  );
}

function MyTransfersContent({ email }: { email: string }) {
  const [search, setSearch] = useState("");
  const [statusSelection, setStatusSelection] = useState<Set<TransferStatus>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [allTransfers, setAllTransfers] = useState<CouncilTransferSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMyTransfers(email)
      .then((result) => {
        if (cancelled) return;
        setAllTransfers(result);
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Unable to load transfers. Try again.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, refreshKey]);

  const availableStatuses = useMemo(
    () => Array.from(new Set(allTransfers.map((t) => t.status))),
    [allTransfers],
  );

  const toggleStatus = (value: TransferStatus) => {
    setStatusSelection((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setPage(1);
  };

  const clearAll = () => {
    setStatusSelection(new Set());
    setPage(1);
  };

  const filtered = allTransfers
    .filter((t) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const haystack = `${t.foundLocation} ${t.animalDescription} ${t.source}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusSelection.size > 0 && !statusSelection.has(t.status)) return false;
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filtersBody = (
    <FiltersBody
      availableStatuses={availableStatuses}
      statusSelection={statusSelection}
      sortOrder={sortOrder}
      onToggleStatus={toggleStatus}
      onSortChange={setSortOrder}
      onClearAll={clearAll}
    />
  );

  return (
    <AppShell
      rightPanel={
        allTransfers.length > 0 ? (
          <aside className="sticky top-14 hidden h-[calc(100vh-56px)] w-[280px] shrink-0 overflow-y-auto border-l border-border bg-page p-4 xl:block">
            {filtersBody}
          </aside>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">My Transfers</h1>
            <p className="mt-1 text-sm text-text-muted">
              Council Transfer submissions you have created.
            </p>
          </div>
          <Link
            href="/new-council-transfer"
            className="h-10 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 inline-flex items-center"
          >
            New Council Transfer
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
            Loading transfers...
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
        ) : allTransfers.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-text">
              You haven&apos;t created any Council Transfer submissions yet.
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Start a new submission to transfer an animal to the shelter.
            </p>
            <Link
              href="/new-council-transfer"
              className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
            >
              New Council Transfer
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="transfer-search" className="sr-only">
                Search transfers
              </label>
              <input
                id="transfer-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by location, source or description"
                className="h-10 min-w-[200px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="h-10 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active xl:hidden"
              >
                Filters
              </button>
            </div>

            {pageItems.length === 0 ? (
              <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
                <p className="text-sm font-semibold text-text">
                  No transfers match your filters.
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  Try a different search term or clear your filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    clearAll();
                  }}
                  className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pageItems.map((transfer) => (
                  <TransferCard key={transfer.id} transfer={transfer} />
                ))}
              </div>
            )}

            {filtered.length > 0 && (
              <div className="flex items-center justify-between text-sm text-text-muted">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-9 rounded-[12px] border border-border bg-surface px-3 font-semibold text-text hover:bg-surface-active disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-9 rounded-[12px] border border-border bg-surface px-3 font-semibold text-text hover:bg-surface-active disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileFiltersOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 right-0 w-[300px] max-w-[85vw] overflow-y-auto border-l border-border bg-page p-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-semibold text-text">Filters</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text hover:bg-surface-active"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="pt-4">{filtersBody}</div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export function MyTransfersScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return <MyTransfersContent email={user.email} />;
}
