import { writeAuditLog } from "@/lib/audit/store";
import type { Role } from "@/lib/roles/roles";
import type { DirectoryUser } from "@/lib/user-administration/types";
import { getJson, send } from "@/lib/shared/http";

// User Administration (FR-UA-01/02) against the database-backed
// /api/users routes - see prisma/contract.prisma. AuditLog is also
// database-backed now (lib/audit/store.ts), written here directly
// after a successful API call, same as before.

export async function listDirectoryUsers(): Promise<DirectoryUser[]> {
  const result = await getJson("/api/users");
  return result.users as DirectoryUser[];
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
export async function createDirectoryUser(input: CreateUserInput): Promise<CreateUserResult> {
  const response = await send("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.json();
}

export type UpdateRoleStatusResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "cannot_deactivate_self_administrator" }
  | { ok: false; reason: "target_not_active_for_transfer" };

export interface UpdateRoleStatusInput {
  targetUserId: string;
  newRole: Role;
  newStatus: "Active" | "Inactive";
  actingAdminEmail: string;
  actingAdminDisplayName: string;
}

// Implements FR-UA-02's role/status rules - see
// app/api/users/[id]/role-status/route.ts for the single-Active-
// Administrator and self-deactivation rules, which now need a database
// read and so live server-side. This wrapper's job is just the request
// and recording the resulting AuditLog entries.
export async function updateUserRoleStatus(input: UpdateRoleStatusInput): Promise<UpdateRoleStatusResult> {
  const response = await send(`/api/users/${input.targetUserId}/role-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      newRole: input.newRole,
      newStatus: input.newStatus,
      actingAdminEmail: input.actingAdminEmail,
      actingAdminDisplayName: input.actingAdminDisplayName,
    }),
  });
  const result = await response.json();
  if (!result.ok) {
    return result;
  }

  if (result.demoted) {
    await writeAuditLog({
      userId: input.actingAdminEmail,
      userName: input.actingAdminDisplayName,
      action: "Role Transfer - Auto-demote Outgoing Administrator",
      entityType: "UserAccount",
      entityId: result.demoted.email,
      oldValue: "role=Administrator",
      newValue: "role=Shelter Staff Member",
      result: "Success",
    });
  }

  if (result.changed) {
    await writeAuditLog({
      userId: input.actingAdminEmail,
      userName: input.actingAdminDisplayName,
      action: "User Role/Status Change",
      entityType: "UserAccount",
      entityId: input.targetUserId,
      oldValue: result.oldValue,
      newValue: result.newValue,
      result: "Success",
    });
  }

  return { ok: true };
}
