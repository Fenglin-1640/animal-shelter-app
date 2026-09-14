import type { Sex, Species } from "@/lib/animals/types";

// FR-INT-02: the 9 required fields, plus system-generated intakeId and
// animalId. Only one of surrenderingPartyName / councilTransferSubmissionId
// applies at a time, and only one of estimatedAge / dateOfBirth.
// isComplete (all 9 fields present) is what a future Finalise Intake
// action (FR-INT-03, not built) would gate on - not enforced here, since
// Staff may fill this in over more than one sitting.
export interface IntakeRecord {
  intakeId: string;
  animalId: string;
  createdByEmail: string;
  createdByName: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface IntakeRecordFormInput {
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
