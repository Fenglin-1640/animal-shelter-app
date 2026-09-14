// FR-CHK-01 / PRD 8.2 SuitabilityCheck. checkType and outcome values
// match System Administration's seeded, systemLocked "Check Type and
// Outcome" category (lib/system-administration/seed-options.ts) -
// hardcoded here per the established pattern for systemLocked values.
export type CheckType = "Reference Check" | "Home Suitability Check" | "Pet Compatibility Check";

export const CHECK_TYPES: CheckType[] = [
  "Reference Check",
  "Home Suitability Check",
  "Pet Compatibility Check",
];

export type CheckOutcome = "Pending" | "Pass" | "Concern" | "Fail";

export interface SuitabilityCheck {
  checkId: string;
  applicationId: string;
  checkType: CheckType;
  outcome: CheckOutcome;
  checkNotes: string;
  conductedDate?: string;
  completedByEmail?: string;
  completedByName?: string;
}
