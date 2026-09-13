"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FilterGroup, FilterPanel, type ActiveFilterChip } from "@/components/layout/filter-panel";
import { NotificationCard } from "@/components/notifications/notification-card";
import { useAuth } from "@/lib/auth/auth-context";
import { getMockNotifications } from "@/lib/notifications/mock-notifications";
import type { NotificationType } from "@/lib/notifications/types";
import {
  loadReadOverrides,
  setReadOverride,
} from "@/lib/notifications/read-state-store";

const PAGE_SIZE = 5;
type SortOrder = "newest" | "oldest" | "due-soonest";
type StatusFilter = "unread" | "read";

function FiltersBody({
  availableTypes,
  statusSelection,
  typeSelection,
  sortOrder,
  onToggleStatus,
  onToggleType,
  onSortChange,
  onClearAll,
}: {
  availableTypes: NotificationType[];
  statusSelection: Set<StatusFilter>;
  typeSelection: Set<NotificationType>;
  sortOrder: SortOrder;
  onToggleStatus: (value: StatusFilter) => void;
  onToggleType: (value: NotificationType) => void;
  onSortChange: (value: SortOrder) => void;
  onClearAll: () => void;
}) {
  const chips: ActiveFilterChip[] = [
    ...Array.from(statusSelection).map((value) => ({
      key: `status-${value}`,
      label: value === "unread" ? "Unread" : "Read",
      onRemove: () => onToggleStatus(value),
    })),
    ...Array.from(typeSelection).map((value) => ({
      key: `type-${value}`,
      label: value,
      onRemove: () => onToggleType(value),
    })),
  ];

  return (
    <FilterPanel activeChips={chips} onClearAll={onClearAll}>
      <FilterGroup heading="Status">
        {(["unread", "read"] as StatusFilter[]).map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={statusSelection.has(value)}
              onChange={() => onToggleStatus(value)}
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            {value === "unread" ? "Unread" : "Read"}
          </label>
        ))}
      </FilterGroup>

      {availableTypes.length > 0 && (
        <FilterGroup heading="Type">
          {availableTypes.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={typeSelection.has(value)}
                onChange={() => onToggleType(value)}
                className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              {value}
            </label>
          ))}
        </FilterGroup>
      )}

      <FilterGroup heading="Sort">
        <select
          value={sortOrder}
          onChange={(event) => onSortChange(event.target.value as SortOrder)}
          className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="due-soonest">Due soonest</option>
        </select>
      </FilterGroup>
    </FilterPanel>
  );
}

export function NotificationsScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusSelection, setStatusSelection] = useState<Set<StatusFilter>>(
    new Set(),
  );
  const [typeSelection, setTypeSelection] = useState<Set<NotificationType>>(
    new Set(),
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const role = user?.role;
  const email = user?.email.toLowerCase() ?? "";

  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>(
    () => loadReadOverrides(email),
  );

  useEffect(() => {
    // `email` is "" on the render before AuthProvider finishes hydrating
    // the session, so the lazy initializer above can miss the real
    // overrides. Re-sync once the real email is known.
    if (!email) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resyncing localStorage-backed state once the account email becomes known.
    setReadOverrides(loadReadOverrides(email));
  }, [email]);

  const allItems = useMemo(
    () => getMockNotifications().filter((item) => role && item.roles.includes(role)),
    [role],
  );

  const availableTypes = useMemo(
    () => Array.from(new Set(allItems.map((item) => item.type))),
    [allItems],
  );

  const isRead = (id: string, defaultRead: boolean) =>
    readOverrides[id] ?? defaultRead;

  const toggleRead = (id: string, defaultRead: boolean) => {
    const next = !isRead(id, defaultRead);
    setReadOverride(email, id, next);
    setReadOverrides((prev) => ({ ...prev, [id]: next }));
  };

  const toggleStatus = (value: StatusFilter) => {
    setStatusSelection((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setPage(1);
  };

  const toggleType = (value: NotificationType) => {
    setTypeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setPage(1);
  };

  const clearAll = () => {
    setStatusSelection(new Set());
    setTypeSelection(new Set());
    setPage(1);
  };

  const filtered = allItems
    .filter((item) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const haystack = `${item.title} ${item.detail}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusSelection.size > 0) {
        const read = isRead(item.id, item.defaultRead);
        const matchesStatus =
          (statusSelection.has("read") && read) ||
          (statusSelection.has("unread") && !read);
        if (!matchesStatus) return false;
      }
      if (typeSelection.size > 0 && !typeSelection.has(item.type)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === "due-soonest") {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return aDue - bDue;
      }
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  if (!user) return null;

  const filtersBody = (
    <FiltersBody
      availableTypes={availableTypes}
      statusSelection={statusSelection}
      typeSelection={typeSelection}
      sortOrder={sortOrder}
      onToggleStatus={toggleStatus}
      onToggleType={toggleType}
      onSortChange={setSortOrder}
      onClearAll={clearAll}
    />
  );

  return (
    <AppShell
      rightPanel={
        <aside
          className="sticky top-14 hidden h-[calc(100vh-56px)] w-[280px] shrink-0 overflow-y-auto border-l border-border bg-page p-4 xl:block"
        >
          {filtersBody}
        </aside>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Notifications</h1>
          <p className="mt-1 text-sm text-text-muted">
            Showing sample notifications for the {user.role} role. Real
            notifications will appear here once intake, medical, behaviour
            and adoption features are built.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="notification-search" className="sr-only">
            Search notifications
          </label>
          <input
            id="notification-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search notifications"
            className="h-10 flex-1 min-w-[200px] rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
              No notifications match your filters.
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Try a different search term or clear your filters to see all
              notifications for your role.
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
            {pageItems.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                isRead={isRead(item.id, item.defaultRead)}
                onToggleRead={() => toggleRead(item.id, item.defaultRead)}
              />
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
