import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth/demo-accounts";
import {
  generateAccountId,
  loadRegisteredAccounts,
  saveRegisteredAccounts,
  type RegisteredAccount,
} from "@/lib/auth/accounts-store";
import { formatDisplayName } from "@/lib/auth/format-name";
import { getProfileOverride } from "@/lib/auth/profile-store";
import { getLockoutState } from "@/lib/auth/lockout-store";
import type { Role } from "@/lib/roles/roles";
import type { DirectoryUser } from "@/lib/user-administration/types";

// Role/Status governance overlay (FR-UA-02), layered on top of the base
// account records the same way lib/auth/profile-store.ts layers Contact
// Details edits - kept separate because these are Administrator actions
// on OTHER users, not self-service edits.
const STORAGE_KEY = "asams-directory-overrides";

export interface DirectoryOverride {
  role?: Role;
  status?: "Active" | "Inactive";
  roleUpdatedBy?: string;
  roleUpdatedAt?: string;
  statusUpdatedBy?: string;
  statusUpdatedAt?: string;
}

function loadOverrides(): Record<string, DirectoryOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, DirectoryOverride>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getDirectoryOverride(email: string): DirectoryOverride | undefined {
  return loadOverrides()[email.trim().toLowerCase()];
}

function mergeDirectoryOverride(email: string, patch: DirectoryOverride) {
  const normalized = email.trim().toLowerCase();
  const overrides = loadOverrides();
  overrides[normalized] = { ...overrides[normalized], ...patch };
  saveOverrides(overrides);
}

interface BaseAccount {
  userId: string;
  email: string;
  title: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: "Active" | "Inactive";
  signUpAt: string;
}

function toDirectoryUser(base: BaseAccount): DirectoryUser {
  const normalized = base.email.toLowerCase();
  const profileOverride = getProfileOverride(normalized);
  const directoryOverride = getDirectoryOverride(normalized);
  const lockout = getLockoutState(normalized);
  const title = profileOverride?.title ?? base.title;
  const firstName = profileOverride?.firstName ?? base.firstName;
  const lastName = profileOverride?.lastName ?? base.lastName;

  return {
    userId: base.userId,
    email: base.email,
    title,
    firstName,
    lastName,
    displayName: formatDisplayName(title, firstName, lastName),
    role: directoryOverride?.role ?? base.role,
    status: directoryOverride?.status ?? base.status,
    isLocked: Boolean(lockout.lockedAt),
    failedAttempts: lockout.failedAttempts,
    signUpAt: base.signUpAt,
    lastLoginAt: profileOverride?.lastLoginAt,
    roleUpdatedBy: directoryOverride?.roleUpdatedBy,
    roleUpdatedAt: directoryOverride?.roleUpdatedAt,
    statusUpdatedBy: directoryOverride?.statusUpdatedBy,
    statusUpdatedAt: directoryOverride?.statusUpdatedAt,
  };
}

export function listDirectoryUsers(): DirectoryUser[] {
  const demoUsers = DEMO_ACCOUNTS.map((account) => toDirectoryUser(account));
  const registeredUsers = loadRegisteredAccounts().map((account) =>
    toDirectoryUser({ ...account, userId: account.id }),
  );
  return [...demoUsers, ...registeredUsers];
}

function isEmailTaken(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (
    DEMO_ACCOUNTS.some((a) => a.email.toLowerCase() === normalized) ||
    loadRegisteredAccounts().some((a) => a.email.toLowerCase() === normalized)
  );
}

export interface CreateUserInput {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Exclude<Role, "Administrator">;
  status: "Active" | "Inactive";
  createdBy: string;
}

export type CreateUserResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "duplicate" };

// Administrator role is intentionally not selectable here: PRD 4.1 only
// describes becoming Administrator via transferring from an existing
// Active user (updateUserRoleStatus below), never by direct creation.
export function createDirectoryUser(input: CreateUserInput): CreateUserResult {
  if (isEmailTaken(input.email)) {
    return { ok: false, reason: "duplicate" };
  }

  const now = new Date().toISOString();
  const account: RegisteredAccount = {
    id: generateAccountId(),
    email: input.email.trim(),
    password: DEMO_PASSWORD,
    role: input.role,
    status: "Active",
    title: input.title,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone.trim(),
    signUpAt: now,
  };
  saveRegisteredAccounts([...loadRegisteredAccounts(), account]);

  if (input.status === "Inactive") {
    mergeDirectoryOverride(account.email, {
      status: "Inactive",
      statusUpdatedBy: input.createdBy,
      statusUpdatedAt: now,
    });
  }

  return { ok: true, userId: account.id };
}

export type UpdateRoleStatusResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "cannot_deactivate_self_administrator" }
  | { ok: false; reason: "target_not_active_for_transfer" };

export interface UpdateRoleStatusInput {
  targetEmail: string;
  newRole: Role;
  newStatus: "Active" | "Inactive";
  actingAdminEmail: string;
  actingAdminDisplayName: string;
}

// Implements FR-UA-02's role/status rules: a single concurrent Active
// Administrator, auto-demoting the outgoing one to Shelter Staff Member
// as part of a transfer (PRD 4.1), and blocking the current
// Administrator from deactivating themselves.
export function updateUserRoleStatus(input: UpdateRoleStatusInput): UpdateRoleStatusResult {
  const normalizedTarget = input.targetEmail.trim().toLowerCase();
  const users = listDirectoryUsers();
  const current = users.find((u) => u.email.toLowerCase() === normalizedTarget);
  if (!current) return { ok: false, reason: "not_found" };

  const isSelf = normalizedTarget === input.actingAdminEmail.trim().toLowerCase();
  if (isSelf && current.role === "Administrator" && input.newStatus === "Inactive") {
    return { ok: false, reason: "cannot_deactivate_self_administrator" };
  }

  const becomingAdministrator =
    input.newRole === "Administrator" && current.role !== "Administrator";

  if (becomingAdministrator) {
    if (input.newStatus !== "Active") {
      return { ok: false, reason: "target_not_active_for_transfer" };
    }
    const now = new Date().toISOString();
    const existingAdmin = users.find(
      (u) =>
        u.role === "Administrator" &&
        u.status === "Active" &&
        u.email.toLowerCase() !== normalizedTarget,
    );
    if (existingAdmin) {
      mergeDirectoryOverride(existingAdmin.email, {
        role: "Shelter Staff Member",
        roleUpdatedBy: input.actingAdminDisplayName,
        roleUpdatedAt: now,
      });
    }
  }

  const now = new Date().toISOString();
  const patch: DirectoryOverride = {};
  if (input.newRole !== current.role) {
    patch.role = input.newRole;
    patch.roleUpdatedBy = input.actingAdminDisplayName;
    patch.roleUpdatedAt = now;
  }
  if (input.newStatus !== current.status) {
    patch.status = input.newStatus;
    patch.statusUpdatedBy = input.actingAdminDisplayName;
    patch.statusUpdatedAt = now;
  }
  if (Object.keys(patch).length > 0) {
    mergeDirectoryOverride(normalizedTarget, patch);
  }

  return { ok: true };
}
