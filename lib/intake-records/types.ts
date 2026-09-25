import type { AnimalPhoto, Sex, Species } from "@/lib/animals/types";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import type { RegisteredOwnerContact } from "@/lib/microchip/types";

// FR-INT-02: the 9 required fields, plus system-generated intakeId and
// animalId. Only one of surrenderingPartyName / councilTransferSubmissionId
// applies at a time, and only one of estimatedAge / dateOfBirth.
// isComplete (all 9 fields present) is what Finalise Intake (FR-INT-03)
// gates on - not enforced by isIntakeRecordComplete alone, since Staff
// may fill this in over more than one sitting; Finalise Intake adds the
// animalName/photos/council-document checks on top (getFinaliseBlockers).
//
// animalName and photos are not part of FR-INT-02's literal 9-field list,
// but are practical additions: Animal.name is used throughout the rest of
// the UI, and FR-INT-03 requires at least one photo before Finalise Intake
// can create the Animal record. finalisedAt marks the record read-only
// once Finalise Intake has run (prevents finalising twice).
//
// breed, adoptionFee, temperaments and generalDescription are also
// outside FR-INT-02's list, but are captured here so Breed is identified
// when the animal enters the shelter and the Animal Profile already
// carries FR-LIST-01's publish fields, instead of them being patched in
// right before listing. generalDescription is the public-facing listing
// description - distinct from the linked Council Transfer's
// animalDescription (FR-INT-01's internal preliminary note).
export interface IntakeRecord {
  intakeId: string;
  animalId: string;
  createdByEmail: string;
  createdByName: string;
  animalName: string;
  arrivalCircumstance: string;
  arrivalDateTime: string;
  intakeSource: string;
  surrenderingPartyName: string;
  councilTransferSubmissionId?: string;
  species: Species | "";
  estimatedAge: string;
  dateOfBirth: string;
  sex: Sex | "";
  coatColour: string;
  coatMarkings: string;
  photos: AnimalPhoto[];
  breed: string;
  adoptionFee?: number;
  temperaments: string[];
  generalDescription: string;
  createdAt: string;
  updatedAt: string;
  finalisedAt?: string;
  // FR-MC-02 step 1: "registered owner contact details linked to IntakeRecord",
  // written by lib/statutory-hold/store.ts when a Scan Microchip lookup
  // (FR-MC-01) returns Owner Match. Not user-editable, so it lives here
  // rather than in IntakeRecordFormInput.
  registeredOwnerContact?: RegisteredOwnerContact;
}

export interface IntakeRecordFormInput {
  animalName: string;
  arrivalCircumstance: string;
  arrivalDateTime: string;
  intakeSource: string;
  surrenderingPartyName: string;
  councilTransferSubmissionId?: string;
  species: Species | "";
  estimatedAge: string;
  dateOfBirth: string;
  sex: Sex | "";
  coatColour: string;
  coatMarkings: string;
  photos: AnimalPhoto[];
  breed: string;
  adoptionFee?: number;
  temperaments: string[];
  generalDescription: string;
}

export function isIntakeRecordComplete(record: IntakeRecordFormInput): boolean {
  const hasSourceParty = Boolean(
    record.councilTransferSubmissionId || record.surrenderingPartyName.trim(),
  );
  const hasAge = Boolean(record.estimatedAge.trim() || record.dateOfBirth.trim());
  return Boolean(
    record.arrivalCircumstance.trim() &&
      record.arrivalDateTime.trim() &&
      record.intakeSource.trim() &&
      hasSourceParty &&
      record.species &&
      hasAge &&
      record.sex &&
      record.coatColour.trim() &&
      record.coatMarkings.trim(),
  );
}

// FR-INT-03: Finalise Intake gates. Listed as a set of unmet-condition
// messages (PRD 5.3: explain each unmet condition) rather than a single boolean, so the
// UI can show Staff exactly what's missing.
export function getFinaliseBlockers(
  record: IntakeRecordFormInput,
  linkedTransfer?: CouncilTransferSubmission,
): string[] {
  const blockers: string[] = [];
  if (!record.animalName.trim()) blockers.push("Animal name is required.");
  if (!isIntakeRecordComplete(record)) {
    blockers.push("All intake record fields must be completed.");
  }
  if (record.photos.length === 0) {
    blockers.push("At least one animal photo must be uploaded.");
  } else if (record.photos.some((p) => !p.altText?.trim())) {
    blockers.push("Every photo needs a description (alt text).");
  }
  if (!record.breed.trim()) blockers.push("Breed is required.");
  if (record.adoptionFee == null) blockers.push("Adoption Fee is required.");
  if (record.temperaments.length === 0) blockers.push("At least one Temperament must be selected.");
  if (!record.generalDescription.trim()) blockers.push("General Description is required.");
  if (record.intakeSource === "Council Transfer") {
    if (!linkedTransfer || linkedTransfer.attachments.length === 0) {
      blockers.push(
        "The linked Council Transfer must have at least one supporting document.",
      );
    }
  }
  return blockers;
}
