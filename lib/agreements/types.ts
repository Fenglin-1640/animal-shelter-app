import type { Species } from "@/lib/animals/types";

// FR-AGR-01 / PRD 8.2 AdoptionAgreement. Status is derived from
// isSigned, never stored separately, so the two can't drift out of
// sync.
export type AgreementStatus = "Pending Signature" | "Signed";

export interface AdoptionAgreement {
  agreementId: string;
  applicationId: string;
  animalId: string;
  animalName: string;
  animalSpecies: Species;
  adopterEmail: string;
  adopterName: string;
  agreementVersion: string;
  adoptionConditions: string;
  returnPolicyPeriod: string;
  generatedAt: string;
  generatedByEmail: string;
  generatedByName: string;
  isSigned: boolean;
  signedDate?: string;
  createdAt: string;
  updatedAt: string;
}
