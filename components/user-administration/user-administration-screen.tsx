"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { CreateUserDialog } from "@/components/user-administration/create-user-dialog";
import { UserDetailDrawer } from "@/components/user-administration/user-detail-drawer";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLES, type Role } from "@/lib/roles/roles";
import { listDirectoryUsers } from "@/lib/user-administration/directory-store";
import { USER_STATUS_CATEGORY } from "@/lib/user-administration/status";
import type { DirectoryUser } from "@/lib/user-administration/types";

const ALLOWED_ROLES: Role[] = ["Administrator"];
type StatusFilter = "" | "Active" | "Inactive" | "Locked";

function UserAdministrationContent({
  email,
  displayName,
}: {
  email: string;
  displayName: string;
}) {
  const { refreshCurrentUser } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // refreshKey is a deliberate cache-buster: listDirectoryUsers() reads
  // localStorage (mutable external state), not refreshKey itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const users = useMemo(() => listDirectoryUsers(), [refreshKey]);

  useEffect(() => {
    if (!selectedUser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync the open drawer's record with the store after a save/unlock, rather than relying on a stale closure.
    setSelectedUser(users.find((u) => u.email === selectedUser.email) ?? null);
    // Only when the underlying list actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleChanged = () => {
    // Deliberately does not call refreshCurrentUser() here: if this save
    // changed the acting admin's own role/status (e.g. transferring the
    // Administrator role away from themselves), refreshing immediately
    // would swap this whole screen to Access Denied in the same commit,
    // before "Changes saved." ever has a chance to render. Session sync
    // is deferred to handleCloseDrawer, once they've seen the result.
    setRefreshKey((k) => k + 1);
  };

  const handleCloseDrawer = () => {
    setSelectedUser(null);
    refreshCurrentUser();
  };

  const filtered = users
    .filter((u) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const haystack = `${u.displayName} ${u.email}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter === "Locked" && !u.isLocked) return false;
      if (statusFilter === "Active" && u.status !== "Active") return false;
      if (statusFilter === "Inactive" && u.status !== "Inactive") return false;
      return true;
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">User Administration</h1>
            <p className="mt-1 text-sm text-text-muted">
              View, create and update user accounts, roles and status.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="h-10 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
          >
            Add User
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="user-search" className="sr-only">
            Search users by name or email
          </label>
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="h-10 min-w-[200px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | "")}
            className="h-10 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Locked">Locked</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-text">No users match your filters.</p>
            <p className="mt-1 text-sm text-text-muted">
              Try a different search term or clear your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-border bg-surface">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Current Role</th>
                  <th className="px-4 py-3">User Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                    <tr
                      key={u.userId}
                      onClick={() => setSelectedUser(u)}
                      className="cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-active"
                    >
                      <td className="px-4 py-3 text-text-muted">{u.title}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-text">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs text-text-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-text">{u.role}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusChip label={u.status} category={USER_STATUS_CATEGORY[u.status]} />
                          {u.isLocked && (
                            <StatusChip label="Locked" category={USER_STATUS_CATEGORY.Locked} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedUser(u);
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

      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          actingAdminEmail={email}
          actingAdminDisplayName={displayName}
          onClose={handleCloseDrawer}
          onSaved={handleChanged}
        />
      )}

      {showCreate && (
        <CreateUserDialog
          createdBy={displayName}
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

export function UserAdministrationScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return <UserAdministrationContent email={user.email} displayName={user.displayName} />;
}
