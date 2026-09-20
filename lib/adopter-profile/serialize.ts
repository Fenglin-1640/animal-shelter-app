import type { Species } from "@/lib/animals/types";
import type { AdopterProfile } from "@/lib/adopter-profile/types";

export interface AdopterProfileRow {
  email: string;
  residentialAddress: string;
  householdType: string;
  homeOwnership: string;
  landlordPermission: number;
  adultsInHousehold: string;
  childrenInHousehold: string;
  hasExistingPets: number;
  existingPetDetails: string;
  environmentDetails: string;
  hoursAlone: string;
  preferredSpecies: string;
  refereeName: string;
  refereeRelationship: string;
  refereePhone: string;
  refereeEmail: string;
  refereeConsent: number;
  refereeConsentAt: Date | null;
}

// Defensive against rows written before preferredSpecies was guaranteed
// to be a JSON-encoded array (see toAdopterProfileRow below) - an empty
// string or any other malformed value falls back to no preference
// selected, rather than throwing and taking down the whole GET (which
// fetches every profile in one call, so one bad row broke every
// Adopter's profile load, not just its own).
function parsePreferredSpecies(value: string): Species[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Species[]) : [];
  } catch {
    return [];
  }
}

export function toAdopterProfile(row: AdopterProfileRow): AdopterProfile {
  return {
    residentialAddress: row.residentialAddress,
    householdType: row.householdType,
    homeOwnership: row.homeOwnership,
    landlordPermission: row.landlordPermission === 1,
    adultsInHousehold: row.adultsInHousehold,
    childrenInHousehold: row.childrenInHousehold,
    hasExistingPets: row.hasExistingPets === 1,
    existingPetDetails: row.existingPetDetails,
    environmentDetails: row.environmentDetails,
    hoursAlone: row.hoursAlone,
    preferredSpecies: parsePreferredSpecies(row.preferredSpecies),
    refereeName: row.refereeName,
    refereeRelationship: row.refereeRelationship,
    refereePhone: row.refereePhone,
    refereeEmail: row.refereeEmail,
    refereeConsent: row.refereeConsent === 1,
    refereeConsentAt: row.refereeConsentAt?.toISOString(),
  };
}

export function toAdopterProfileRow(email: string, profile: AdopterProfile): Omit<AdopterProfileRow, "refereeConsentAt"> & { refereeConsentAt: Date | null } {
  return {
    email,
    residentialAddress: profile.residentialAddress,
    householdType: profile.householdType,
    homeOwnership: profile.homeOwnership,
    landlordPermission: profile.landlordPermission ? 1 : 0,
    adultsInHousehold: profile.adultsInHousehold,
    childrenInHousehold: profile.childrenInHousehold,
    hasExistingPets: profile.hasExistingPets ? 1 : 0,
    existingPetDetails: profile.existingPetDetails,
    environmentDetails: profile.environmentDetails,
    hoursAlone: profile.hoursAlone,
    preferredSpecies: JSON.stringify(Array.isArray(profile.preferredSpecies) ? profile.preferredSpecies : []),
    refereeName: profile.refereeName,
    refereeRelationship: profile.refereeRelationship,
    refereePhone: profile.refereePhone,
    refereeEmail: profile.refereeEmail,
    refereeConsent: profile.refereeConsent ? 1 : 0,
    refereeConsentAt: profile.refereeConsentAt ? new Date(profile.refereeConsentAt) : null,
  };
}
