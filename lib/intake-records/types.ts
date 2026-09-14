import type { AnimalPhoto, Sex, Species } from "@/lib/animals/types";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";

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
  createdAt: string;
  updatedAt: string;
  finalisedAt?: string;
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
// messages (PRD 5.3 "逐项说明未满足条件") rather than a single boolean, so the
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
  }
  if (record.intakeSource === "Council Transfer") {
    if (!linkedTransfer || linkedTransfer.attachments.length === 0) {
      blockers.push(
        "The linked Council Transfer must have at least one supporting document.",
      );
    }
  }
  return blockers;
}
