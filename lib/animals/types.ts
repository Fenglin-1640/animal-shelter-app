// Field subset of PRD 8.2 Animal needed for the Animals list/card and
// Animal Profile detail page (FR-AN-01, FR-AN-02).
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

export interface LinkedPerson {
  role: "Registered Owner" | "Adopter";
  name: string;
}

// Metadata only (no file content stored - there is no file/blob storage
// in this prototype, consistent with Council Transfer attachments).
// Used only by the Intake Record form's simple "at least one photo
// uploaded" Finalise Intake gate (FR-INT-03) - once the Animal exists,
// Save and Finalise Intake (app/api/intake-records/finalise) converts these into full
// Photo records (FR-AN-02: altText, selecting the public listing photo,
// dateTaken/takenBy).
export interface AnimalPhoto {
  id: string;
  fileName: string;
  fileSizeKB: number;
  uploadedAt: string;
  // The actual uploaded image, as a base64 data URL - same field/format
  // as Photo.imageData (lib/photos/types.ts), carried through here so a
  // photo added during Intake keeps its real bytes once
  // Save and Finalise Intake converts it into a full Photo record, instead
  // of only ever getting a placeholder graphic. Optional since older
  // rows predate this field.
  imageData?: string;
  // Screen-reader description, optionally entered at upload and carried
  // onto the Photo record. Not required at Intake - Publish requires it
  // on the public listing photo, and it can be added later on the Photos
  // screen.
  altText?: string;
}

export interface Animal {
  animalId: string;
  shelterId: string;
  name: string;
  // Identity
  species: Species;
  breed: string;
  breedDescription: string;
  sex: Sex;
  dateOfBirth?: string;
  estimatedAge?: string;
  coatColour: string;
  coatMarkings: string;
  microchipNumber?: string;
  // Adoption
  generalDescription: string;
  temperaments: string[];
  adoptionFee?: number;
  currentStatus: CurrentStatus;
  listingStatus: ListingStatus;
  statusUpdatedAt: string;
  // Lifecycle
  enteredAt: string;
  lastModifiedAt: string;
  intakeSource: string;
  linkedPerson?: LinkedPerson;
}
