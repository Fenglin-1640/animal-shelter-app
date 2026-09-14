"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { CreateOptionDialog } from "@/components/system-administration/create-option-dialog";
import { OptionDetailDrawer } from "@/components/system-administration/option-detail-drawer";
import { useAuth } from "@/lib/auth/auth-context";
import type { Role } from "@/lib/roles/roles";
import { listOptions } from "@/lib/system-administration/store";
import { OPTION_STATUS_CATEGORY } from "@/lib/system-administration/status";
import { DROPDOWN_CATEGORIES, type DropdownCategory, type DropdownOption } from "@/lib/system-administration/types";

const ALLOWED_ROLES: Role[] = ["Administrator"];
type StatusFilter = "" | "Active" | "Retired";

function SystemAdministrationContent() {
  const [category, setCategory] = useState<DropdownCategory>("Title");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOption, setSelectedOption] = useState<DropdownOption | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // refreshKey is a deliberate cache-buster: listOptions() reads
  // localStorage (mutable external state), not refreshKey itself.
  const options = useMemo(
    () => listOptions(category, { includeRetired: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, refreshKey],
  );

  useEffect(() => {
    if (!selectedOption) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync the open drawer's record with the store after a save/retire, rather than relying on a stale closure.
    setSelectedOption(options.find((o) => o.id === selectedOption.id) ?? null);
    // Only when the underlying list actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleChanged = () => setRefreshKey((k) => k + 1);
  const isBreedCategory = category === "Breed and Description";

  const filtered = options
    .filter((o) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const haystack = `${o.value} ${o.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter === "Active" && o.isRetired) return false;
      if (statusFilter === "Retired" && !o.isRetired) return false;
      return true;
    })
    .sort((a, b) => a.value.localeCompare(b.value));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">System Administration</h1>
            <p className="mt-1 text-sm text-text-muted">
              Maintain dropdown options used across ASAMS. Retired options
              are removed from new-record pickers but stay visible on
              existing records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="h-10 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
          >
            Add Option
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="option-category" className="sr-only">
            Category
          </label>
          <select
            id="option-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as DropdownCategory);
              setSearch("");
              setStatusFilter("");
            }}
            className="h-10 rounded-[12px] border border-border bg-surface px-2 text-sm font-semibold text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {DROPDOWN_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label htmlFor="option-search" className="sr-only">
            Search options by value or description
          </label>
          <input
            id="option-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by value or description"
            className="h-10 min-w-[200px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Retired">Retired</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-text">No options match your filters.</p>
            <p className="mt-1 text-sm text-text-muted">
              Try a different search term or clear your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-border bg-surface">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Description</th>
                  {isBreedCategory && <th className="px-4 py-3">Species</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOption(o)}
                    className="cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-active"
                  >
                    <td className="px-4 py-3 font-semibold text-text">{o.value}</td>
                    <td className="px-4 py-3 text-text-muted">{o.description}</td>
                    {isBreedCategory && <td className="px-4 py-3 text-text">{o.speciesId}</td>}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusChip
                          label={o.isRetired ? "Retired" : "Active"}
                          category={OPTION_STATUS_CATEGORY[o.isRetired ? "Retired" : "Active"]}
                        />
                        {o.systemLocked && (
                          <span className="inline-flex items-center rounded-full border border-border-strong bg-surface-active px-2 py-0.5 text-xs text-text-muted">
                            Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedOption(o);
                        }}
                        className="h-8 rounded-[12px] border border-border bg-page px-3 text-xs font-semibold text-text hover:bg-surface-active"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOption && (
        <OptionDetailDrawer
          option={selectedOption}
          onClose={() => setSelectedOption(null)}
          onSaved={handleChanged}
        />
      )}

      {showCreate && (
        <CreateOptionDialog
          category={category}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            handleChanged();
          }}
        />
      )}
    </AppShell>
  );
}

export function SystemAdministrationScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return <SystemAdministrationContent />;
}
