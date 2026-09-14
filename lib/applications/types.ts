import type { Species } from "@/lib/animals/types";

// Field subset of PRD 8.2 AdoptionApplication needed for the Adopter's
// own read-only "My Applications" list (FR-APP-01, FR-CHK-02: adopters
// see status and a plain-language reason, never internal check notes).
export type ApplicationStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "On Hold"
  | "Approved"
  | "Rejected"
  | "Finalised";

export interface AdopterApplication {
  applicationId: string;
  adopterEmail: string;
  animalId: string;
  animalName: string;
  animalSpecies: Species;
  animalBreed: string;
  applicationStatus: ApplicationStatus;
  submissionDate?: string;
  decisionDate?: string;
  rejectionReason?: string;
  nextStep?: string;
}
