import type { CurrentStatus, ListingStatus } from "@/lib/animals/types";

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

// PRD 7.2 listingStatus. Pre-Listing is only reachable from Not Fit (the
// system move once the clearance, hold, behaviour and Review Adoption
// Fitness conditions all hold - see getPreListingBlockers() in
// lib/adoption-listings/pre-listing.ts), and Current only from
// Pre-Listing (BR-007: Staff
// publish from Pre-Listing). Removed is reachable from any non-final
// listing state (reclaimed, permanently unsuitable, or withdrawn).
export const ALLOWED_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  "Not Fit": ["Pre-Listing", "Removed"],
  "Pre-Listing": ["Current", "Removed"],
  Current: ["Adopted", "Removed"],
  Adopted: ["Removed"],
  Removed: [],
};

export function isValidListingTransition(from: ListingStatus, to: ListingStatus): boolean {
  if (from === to) return true;
  return ALLOWED_LISTING_TRANSITIONS[from]?.includes(to) ?? false;
}
