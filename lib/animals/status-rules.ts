import type { CurrentStatus } from "@/lib/animals/types";

// PRD 7.1 state table's "允许的下一状态" column. Named final states
// (ReturnedToOwner, Archived, Rehomed) have no further transitions.
export const ALLOWED_STATUS_TRANSITIONS: Record<CurrentStatus, CurrentStatus[]> = {
  "Under Assessment": [
    "On Statutory Hold",
    "Under Treatment",
    "In Behaviour Program",
    "Available For Adoption",
  ],
  "On Statutory Hold": ["Reclaimed By Owner", "Under Assessment"],
  "Reclaimed By Owner": ["ReturnedToOwner"],
  "Under Treatment": ["Under Assessment", "Awaiting Release"],
  "In Behaviour Program": ["Under Assessment", "Unsuitable For Adoption"],
  "Unsuitable For Adoption": ["Archived"],
  "Available For Adoption": ["Application In Progress"],
  "Application In Progress": ["Available For Adoption", "Awaiting Release"],
  "Awaiting Release": ["Under Treatment", "inFollowUpPeriod"],
  inFollowUpPeriod: ["Rehomed"],
  ReturnedToOwner: [],
  Archived: [],
  Rehomed: [],
};

export function isValidStatusTransition(from: CurrentStatus, to: CurrentStatus): boolean {
  if (from === to) return true;
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
