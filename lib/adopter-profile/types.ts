import type { Species } from "@/lib/animals/types";

// FR-ADP-01 / PRD 8.2 Adopter fields, minus Person-level identity
// (covered by My Profile / SC-04). Numeric fields are kept as raw
// strings from their inputs and parsed only for validation.
export interface AdopterProfile {
  residentialAddress: string;
  householdType: string;
  homeOwnership: string;
  landlordPermission: boolean;
  adultsInHousehold: string;
  childrenInHousehold: string;
  hasExistingPets: boolean;
  existingPetDetails: string;
  environmentDetails: string;
  hoursAlone: string;
  preferredSpecies: Species[];
  refereeName: string;
  refereeRelationship: string;
  refereePhone: string;
  refereeEmail: string;
  refereeConsent: boolean;
  refereeConsentAt?: string;
}

// FR-APP-01: "缺少必填字段时不得提交，并高亮全部错误" - Submit Adoption Application's
// own, stricter completeness check. Saving the Profile itself (My
// Adopter Profile) only requires the referee section when the Adopter
// has started filling it in or ticked consent - deliberately lenient so
// an Adopter can save partial progress. An Application submission has
// no such lenience: referee contact and consent are always required.
export function getAdopterProfileSubmissionBlockers(profile: AdopterProfile): string[] {
  const blockers: string[] = [];
  if (!profile.residentialAddress.trim()) blockers.push("Residential address must be filled in.");
  if (!profile.householdType) blockers.push("Household type must be selected.");
  if (!profile.homeOwnership) blockers.push("Home ownership status must be selected.");
  if (profile.homeOwnership === "Rent" && !profile.landlordPermission) {
    blockers.push("Landlord permission must be confirmed.");
  }
  if (!profile.adultsInHousehold.trim()) blockers.push("Number of adults in household must be filled in.");
  if (profile.hasExistingPets && !profile.existingPetDetails.trim()) {
    blockers.push("Existing pet details must be filled in.");
  }
  if (!profile.environmentDetails.trim()) blockers.push("Environment details must be filled in.");
  if (!profile.hoursAlone) blockers.push("Typical hours alone must be selected.");
  if (!profile.refereeName.trim()) blockers.push("Referee name must be filled in.");
  if (!profile.refereeRelationship.trim()) blockers.push("Referee relationship must be filled in.");
  if (!profile.refereePhone.trim()) blockers.push("Referee phone must be filled in.");
  if (!profile.refereeEmail.trim()) blockers.push("Referee email must be filled in.");
  if (!profile.refereeConsent) blockers.push("Consent to store and contact the referee is required.");
  return blockers;
}

export const EMPTY_ADOPTER_PROFILE: AdopterProfile = {
  residentialAddress: "",
  householdType: "",
  homeOwnership: "",
  landlordPermission: false,
  adultsInHousehold: "",
  childrenInHousehold: "",
  hasExistingPets: false,
  existingPetDetails: "",
  environmentDetails: "",
  hoursAlone: "",
  preferredSpecies: [],
  refereeName: "",
  refereeRelationship: "",
  refereePhone: "",
  refereeEmail: "",
  refereeConsent: false,
};
