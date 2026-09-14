import type { Role } from "@/lib/roles/roles";

// FR-UA-01 / PRD 8.2 UserAccount, merged from DEMO_ACCOUNTS and
// Sign-Up-created RegisteredAccounts plus their profile/directory
// overrides, for display in User Administration.
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
