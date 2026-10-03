import type { Role } from "@/lib/roles/roles";

// Role groups the API route guards use (see requireRole in
// lib/auth/server-session.ts). Each route's allowance follows PRD 9's
// permission matrix together with what the UI actually calls the route
// for - business logic runs client-side, so one user action can write to
// another domain's route (e.g. a Veterinarian's medical action completes
// an Adoption Fitness task), and the route has to admit that role too.

export const ALL_ROLES: readonly Role[] = [
  "Administrator",
  "Shelter Staff Member",
  "Veterinarian",
  "Council Animal Control Officer",
  "Adopter",
];

// Administrator inherits the Shelter Staff Member's permission set (PRD 9:
// "全部 Staff 操作"), but not the Veterinarian's clinical authority (BR-005).
export const STAFF: readonly Role[] = ["Administrator", "Shelter Staff Member"];

// Everyone who works with internal animal records (Veterinarian mostly
// read-only outside Medical).
export const CARE_TEAM: readonly Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

export const VETERINARIAN: readonly Role[] = ["Veterinarian"];
export const ADMINISTRATOR: readonly Role[] = ["Administrator"];
export const ADOPTER: readonly Role[] = ["Adopter"];
export const COUNCIL_OFFICER: readonly Role[] = ["Council Animal Control Officer"];

// Roles that see every record of a personal collection (applications,
// agreements, payments, Meet and Greets, follow-up visits); any other role
// sees only records where it is the adopter.
export function seesAllRecords(role: Role): boolean {
  return CARE_TEAM.includes(role);
}

// Whether a personal record (keyed by the adopter's email) belongs to the
// signed-in user.
export function isOwnRecord(user: { email: string }, adopterEmail: string | null | undefined): boolean {
  return !!adopterEmail && adopterEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
}
