// Field subset of PRD 8.2 Animal needed for the Animals list/card (FR-AN-01).
export type Species = "Cat" | "Dog" | "Bird" | "Reptile";
export type Sex = "Male" | "Female";

// PRD 7.1 Animal.currentStatus (10 active states + 3 named final states).
export type CurrentStatus =
  | "Under Assessment"
  | "On Statutory Hold"
  | "Reclaimed By Owner"
  | "Under Treatment"
  | "In Behaviour Program"
  | "Unsuitable For Adoption"
  | "Available For Adoption"
  | "Application In Progress"
  | "Awaiting Release"
  | "inFollowUpPeriod"
  | "ReturnedToOwner"
  | "Archived"
  | "Rehomed";

// PRD 7.2 Animal.listingStatus.
export type ListingStatus = "Not Fit" | "Pre-Listing" | "Current" | "Adopted" | "Removed";

export interface Animal {
  animalId: string;
  shelterId: string;
  name: string;
  species: Species;
  breed: string;
  sex: Sex;
  dateOfBirth?: string;
  estimatedAge?: string;
  generalDescription: string;
  temperaments: string[];
  currentStatus: CurrentStatus;
  listingStatus: ListingStatus;
  enteredAt: string;
}
