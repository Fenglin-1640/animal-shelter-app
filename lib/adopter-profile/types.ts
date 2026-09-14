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
