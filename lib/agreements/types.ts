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
  // FR-SA-02's Administrator-configured "默认 Adoption Agreement 条款版本" at
  // the moment this agreement was generated - distinct from
  // agreementVersion above, which counts THIS application's own
  // regenerations (v1.0, v2.0...), not the shelter-wide terms template.
  templateVersion: string;
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
