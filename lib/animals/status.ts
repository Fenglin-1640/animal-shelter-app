import type { StatusCategory } from "@/lib/shared/status-category";
import type { CurrentStatus, ListingStatus } from "@/lib/animals/types";

// PRD 5.8.3 status-to-category table, covering every currentStatus (7.1)
// and listingStatus (7.2) value.
export const CURRENT_STATUS_CATEGORY: Record<CurrentStatus, StatusCategory> = {
  "Under Assessment": "progress",
  "On Statutory Hold": "caution",
  "Reclaimed By Owner": "complete",
  "Under Treatment": "attention",
  "In Behaviour Program": "attention",
  "Unsuitable For Adoption": "neutral",
  "Available For Adoption": "success",
  "Application In Progress": "progress",
  "Awaiting Release": "progress",
  inFollowUpPeriod: "progress",
  ReturnedToOwner: "complete",
  Archived: "neutral",
  Rehomed: "complete",
};

export const LISTING_STATUS_CATEGORY: Record<ListingStatus, StatusCategory> = {
  "Not Fit": "neutral",
  "Pre-Listing": "caution",
  Current: "success",
  Adopted: "complete",
  Removed: "neutral",
};
