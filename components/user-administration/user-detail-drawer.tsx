"use client";

import { useState } from "react";
import { StatusChip } from "@/components/shared/status-chip";
import { resetLockout } from "@/lib/auth/lockout-store";
import { ROLES, type Role } from "@/lib/roles/roles";
import { updateUserRoleStatus } from "@/lib/user-administration/directory-store";
import { USER_STATUS_CATEGORY } from "@/lib/user-administration/status";
import type { DirectoryUser } from "@/lib/user-administration/types";

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function UserDetailDrawer({
  user,
  actingAdminEmail,
  actingAdminDisplayName,
  onClose,
  onSaved,
}: {
  user: DirectoryUser;
  actingAdminEmail: string;
  actingAdminDisplayName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isSelf = user.email.toLowerCase() === actingAdminEmail.toLowerCase();
  const isSelfAdministrator = isSelf && user.role === "Administrator";

  const [selectedRole, setSelectedRole] = useState<Role>(user.role);
  const [selectedStatus, setSelectedStatus] = useState<"Active" | "Inactive">(user.status);
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const performSave = () => {
    setIsSaving(true);
    setError(null);
    const result = updateUserRoleStatus({
      targetEmail: user.email,
      newRole: selectedRole,
      newStatus: selectedStatus,
      actingAdminEmail,
      actingAdminDisplayName,
    });
    setIsSaving(false);
    setConfirmingTransfer(false);

    if (!result.ok) {
      if (result.reason === "cannot_deactivate_self_administrator") {
        setError("The current Administrator cannot be set to Inactive.");
      } else if (result.reason === "target_not_active_for_transfer") {
        setError("Transferring the Administrator role requires Status = Active.");
      } else {
        setError("User not found.");
      }
      return;
    }

    setMessage("Changes saved.");
    onSaved();
  };

  const handleSaveClick = () => {
    setMessage(null);
    const becomingAdministrator = selectedRole === "Administrator" && user.role !== "Administrator";
    if (becomingAdministrator && !confirmingTransfer) {
      setConfirmingTransfer(true);
      return;
    }
    performSave();
  };

  const handleUnlock = () => {
    setIsUnlocking(true);
    resetLockout(user.email);
    setIsUnlocking(false);
    setMessage("Account unlocked.");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close user details"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-y-0 right-0 w-[380px] max-w-[90vw] overflow-y-auto border-l border-border bg-page p-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <span className="text-sm font-semibold text-text">User Details</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close user details"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text hover:bg-surface-active"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-text">{user.displayName}</h2>
            <p className="text-sm text-text-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusChip label={user.status} category={USER_STATUS_CATEGORY[user.status]} />
              {user.isLocked && (
                <StatusChip label="Locked" category={USER_STATUS_CATEGORY.Locked} />
              )}
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 rounded-[12px] border border-border bg-surface p-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Sign Up Date Time
              </dt>
              <dd className="text-sm text-text">{formatDateTime(user.signUpAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Last Login
              </dt>
              <dd className="text-sm text-text">{formatDateTime(user.lastLoginAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Role Updated By and At
              </dt>
              <dd className="text-sm text-text">
                {user.roleUpdatedBy
                  ? `${user.roleUpdatedBy} · ${formatDateTime(user.roleUpdatedAt)}`
                  : "Not changed since creation"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Status Updated By and At
              </dt>
              <dd className="text-sm text-text">
                {user.statusUpdatedBy
                  ? `${user.statusUpdatedBy} · ${formatDateTime(user.statusUpdatedAt)}`
                  : "Not changed since creation"}
              </dd>
            </div>
          </dl>

          {user.isLocked && (
            <div className="rounded-[12px] border border-danger bg-danger/10 p-3">
              <p className="text-sm text-text">
                This account is locked after {user.failedAttempts} failed sign-in
                attempts.
              </p>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={isUnlocking}
                className="mt-2 h-8 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-active disabled:opacity-60"
              >
                {isUnlocking ? "Unlocking..." : "Unlock Account"}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-3">
            <h3 className="text-sm font-bold text-text">Role and Status</h3>

            <div className="flex flex-col gap-1">
              <label htmlFor="directory-role" className="text-xs font-semibold text-text-muted">
                Role
              </label>
              <select
                id="directory-role"
                value={selectedRole}
                onChange={(event) => {
                  setSelectedRole(event.target.value as Role);
                  setConfirmingTransfer(false);
                  setError(null);
                }}
                className="h-9 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="directory-status" className="text-xs font-semibold text-text-muted">
                Status
              </label>
              <select
                id="directory-status"
                value={selectedStatus}
                onChange={(event) => {
                  setSelectedStatus(event.target.value as "Active" | "Inactive");
                  setConfirmingTransfer(false);
                  setError(null);
                }}
                className="h-9 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <option value="Active">Active</option>
                <option value="Inactive" disabled={isSelfAdministrator}>
                  Inactive
                </option>
              </select>
              {isSelfAdministrator && (
                <p className="text-xs text-text-muted">
                  The current Administrator cannot be set to Inactive.
                </p>
              )}
            </div>

            {confirmingTransfer && (
              <div className="rounded-[12px] border border-gold bg-gold/15 p-3 text-sm text-text">
                <p>
                  This transfers the Administrator role to {user.displayName}. You
                  ({actingAdminDisplayName}) will become Shelter Staff Member.
                  Confirm?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={performSave}
                    disabled={isSaving}
                    className="h-8 rounded-[12px] bg-primary px-3 text-xs font-semibold text-page hover:opacity-90 disabled:opacity-60"
                  >
                    {isSaving ? "Confirming..." : "Confirm Transfer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingTransfer(false)}
                    className="h-8 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-active"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            {message && !confirmingTransfer && (
              <p role="status" className="text-sm text-text">
                {message}
              </p>
            )}

            {!confirmingTransfer && (
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={isSaving}
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
