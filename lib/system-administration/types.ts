import type { Species } from "@/lib/animals/types";

// FR-SA-01: the 13 dropdown option categories PRD 6.3 names, plus
// "Vaccine Type" - added later so the Vaccination form's Vaccine Type
// field could follow the same seeded-dropdown pattern as Treatment
// Event's Medication field, rather than staying free text. This is a
// deliberate addition beyond PRD 6.3's literal 13-category list.
export const DROPDOWN_CATEGORIES = [
  "Title",
  "User Role",
  "Species",
  "Breed and Description",
  "Medication",
  "Temperament",
  "Sex",
  "Intake Source",
  "Application Status",
  "Check Type and Outcome",
  "Payment Method",
  "Follow Up Type",
  "Document Type",
  "Vaccine Type",
] as const;

export type DropdownCategory = (typeof DROPDOWN_CATEGORIES)[number];

export interface DropdownOption {
  id: string;
  category: DropdownCategory;
  value: string;
  description: string;
  speciesId?: Species;
  isRetired: boolean;
  // "Administrator 和关键系统状态标记为 systemLocked，不得停用" (PRD 6.3):
  // values the app's own code already hardcodes as literal types (Species,
  // Sex, Application Status, Check Type/Outcome, Follow Up Type) or that
  // the PRD names directly (the Administrator role) can't be retired.
  systemLocked: boolean;
  createdAt: string;
  updatedAt: string;
}
