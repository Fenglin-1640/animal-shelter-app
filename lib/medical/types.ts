// FR-MED-01/02/03. PRD 8.2's `MedicalRecord` class is a per-animal
// aggregate summary (recordId, animalId, responsibleVeterinarianId,
// assessmentDate, bodyCondition, vaccinationStatus, desexingStatus,
// clearanceStatus, clearanceIssuedAt, clearanceIssuedBy); PRD 8.3's
// `MedicalEvent` support entity is what actually holds the repeatable
// event data ("Health Assessment、Treatment、Vaccination、Desexing... 的多次事件").
// This module implements the event-level entities directly (one type per
// event kind) rather than a generic MedicalEvent + MedicalRecord pair,
// since each kind has a distinct fixed field set per the FR text and a
// generic shape would just be these same fields behind an `any`-ish
// payload. Nothing here is ever edited or deleted once created (BR-013).
export type TreatmentPathway = "intake" | "pre-release";

export interface HealthAssessment {
  id: string;
  animalId: string;
  examinationObservations: string;
  sampleTestResults: string;
  diagnosedConditions: string;
  bodyCondition: string;
  // FR-MED-01 lists "urgent treatment requirements" as a field to record;
  // FR-MED-02 needs a boolean flag to trigger Under Treatment. Modelled
  // as both: the flag drives the status transition, the notes field
  // carries the free-text description PRD's field name implies.
  urgentTreatmentRequired: boolean;
  urgentTreatmentNotes: string;
  // Captured only when urgentTreatmentRequired is true: which pathway
  // triggered this episode (the Animal's currentStatus at that moment),
  // so FR-MED-02's "intake pathway 返回 Under Assessment" vs "pre-release
  // pathway 返回 Awaiting Release" resolves correctly once treatment
  // completes, however many treatment events later. This animal record
  // itself is the "原始 MedicalRecord" each treatment event links back to.
  treatmentPathway?: TreatmentPathway;
  assessmentDate: string;
  veterinarianEmail: string;
  veterinarianName: string;
  createdAt: string;
}

export interface TreatmentEvent {
  id: string;
  animalId: string;
  linkedHealthAssessmentId: string;
  medication: string;
  dose: string;
  date: string;
  outcome: string;
  furtherTreatmentRequired: boolean;
  veterinarianEmail: string;
  veterinarianName: string;
  createdAt: string;
}

export interface VaccinationRecord {
  id: string;
  animalId: string;
  vaccineType: string;
  administrationDate: string;
  doseOrChipId: string;
  nextBoosterDueDate: string;
  veterinarianEmail: string;
  veterinarianName: string;
  createdAt: string;
}

export type DesexingStatus = "Scheduled" | "Completed";

export interface DesexingSchedule {
  id: string;
  animalId: string;
  scheduledDate: string;
  status: DesexingStatus;
  completedAt?: string;
  completedByEmail?: string;
  completedByName?: string;
  veterinarianEmail: string;
  veterinarianName: string;
  createdAt: string;
}

export interface MedicalClearance {
  id: string;
  animalId: string;
  issuedByEmail: string;
  issuedByName: string;
  issuedAt: string;
}
