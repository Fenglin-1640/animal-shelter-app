import type { Role } from "@/lib/roles/roles";

// FR-UA-01 / PRD 8.2 UserAccount, as served by GET /api/users (see
// prisma/contract.prisma and lib/user-administration/serialize.ts), for
// display in User Administration.
export interface DirectoryUser {
  userId: string;
  email: string;
  title: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: Role;
  status: "Active" | "Inactive";
  isLocked: boolean;
  failedAttempts: number;
  signUpAt: string;
  lastLoginAt?: string;
  roleUpdatedBy?: string;
  roleUpdatedAt?: string;
  statusUpdatedBy?: string;
  statusUpdatedAt?: string;
}
