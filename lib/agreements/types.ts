import type { Species } from "@/lib/animals/types";

// FR-AGR-01 / PRD 8.2 AdoptionAgreement, scoped to the Adopter's own
// read-only view. Status is derived from isSigned, never stored
// separately, so the two can't drift out of sync.
export type AgreementStatus = "Pending Signature" | "Signed";

export interface AdopterAgreement {
  agreementId: string;
  adopterEmail: string;
  applicationId: string;
  animalId: string;
  animalName: string;
  animalSpecies: Species;
  agreementVersion: string;
  adoptionConditions: string;
  returnPolicyPeriod: string;
  generatedAt: string;
  isSigned: boolean;
  signedDate?: string;
  nextStep?: string;
}
