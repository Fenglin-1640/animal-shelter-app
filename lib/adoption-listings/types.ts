import type { Sex, Species } from "@/lib/animals/types";

// FR-LIST-02: only these fields may ever reach the public Adoption
// Listings screen. Internal Medical History, Behaviour Risks, Owner
// History, Council Records, Internal Assessments and the full microchip
// number must never appear here - enforced by keeping this a distinct,
// narrower shape rather than reusing the internal Animal type.
export interface PublicListing {
  animalId: string;
  shelterId: string;
  name: string;
  species: Species;
  breed: string;
  sex: Sex;
  age: string;
  temperaments: string[];
  adoptionFee?: number;
  generalDescription: string;
  acceptingApplications: boolean;
  // FR-AN-02's public listing photo, once selected (Adopter may only
  // ever see this one approved photo, never the full Photos list).
  photoAltText?: string;
}
