import { formatDisplayName } from "@/lib/auth/format-name";
import type { Role } from "@/lib/roles/roles";
import type { DirectoryUser } from "@/lib/user-administration/types";

// Server-side row shape returned by the Prisma 8 contract client for the
// User model (see prisma/contract.prisma) - password included, since this
// is also reused to build the sign-in session user before the password
// field is dropped.
export interface UserRow {
  id: string;
  email: string;
  password: string;
  role: string;
  status: string;
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  signUpAt: Date;
  lastLoginAt: Date | null;
  roleUpdatedBy: string | null;
  roleUpdatedAt: Date | null;
  statusUpdatedBy: string | null;
  statusUpdatedAt: Date | null;
  failedLoginAttempts: number;
  lockedAt: Date | null;
}

// DirectoryUser is the client-facing shape (FR-UA-01) - never includes
// the password field.
export function toDirectoryUser(row: UserRow): DirectoryUser {
  return {
    userId: row.id,
    email: row.email,
    title: row.title,
    firstName: row.firstName,
    lastName: row.lastName,
    displayName: formatDisplayName(row.title, row.firstName, row.lastName),
    role: row.role as Role,
    status: row.status as "Active" | "Inactive",
    isLocked: Boolean(row.lockedAt),
    failedAttempts: row.failedLoginAttempts,
    signUpAt: row.signUpAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString(),
    roleUpdatedBy: row.roleUpdatedBy ?? undefined,
    roleUpdatedAt: row.roleUpdatedAt?.toISOString(),
    statusUpdatedBy: row.statusUpdatedBy ?? undefined,
    statusUpdatedAt: row.statusUpdatedAt?.toISOString(),
  };
}
