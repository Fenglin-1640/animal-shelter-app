import type { Animal } from "@/lib/animals/types";

// FR-INT-04: the three tasks created in parallel once Finalise Intake
// (FR-INT-03) runs. Each task's full result is recorded by its own
// dedicated feature, which marks the task Continuable itself via
// completeTaskByType() (lib/adoption-fitness/store.ts) once it reaches a
// continuable outcome: Scan Microchip (FR-MC-01/02, lib/microchip), a
// Health Assessment without urgent treatment or a completed intake
// treatment (FR-MED-01/02, lib/medical), and a Suitable for Adoption
// Temperament Assessment (FR-BEH-01, lib/behaviour). This module only
// tracks whether each track has reached the "continuable" state BR-016
// requires before Review Adoption Fitness is allowed - there is no
// manual "Mark Continuable" action.
export type TaskType = "Microchip Check" | "Temperament Assessment" | "Health Assessment";
export const TASK_TYPES: TaskType[] = [
  "Microchip Check",
  "Temperament Assessment",
  "Health Assessment",
];

export type TaskStatus = "Pending" | "Continuable";

export interface AssessmentTask {
  id: string;
  animalId: string;
  taskType: TaskType;
  status: TaskStatus;
  markedByEmail?: string;
  markedByName?: string;
  markedAt?: string;
}

// The joint Shelter Staff Member + Veterinarian confirmation.
// Review Adoption Fitness itself does not change Animal.currentStatus
// (Publish Adoption Profile, FR-LIST-01, is what sets Available For
// Adoption; PRD 12.1's Ruby stays Under Assessment/Pre-Listing even once
// Vet-cleared). It is, however, a required Pre-Listing condition
// (getPreListingBlockers() in lib/adoption-listings/pre-listing.ts) - a
// deliberate tightening beyond FR-MED-03's literal three conditions - so
// completing it can trigger the automatic listingStatus move to
// Pre-Listing when the other conditions already hold.
export interface FitnessReview {
  animalId: string;
  staffConfirmedByEmail?: string;
  staffConfirmedByName?: string;
  staffConfirmedAt?: string;
  vetConfirmedByEmail?: string;
  vetConfirmedByName?: string;
  vetConfirmedAt?: string;
  // "Confirmed together with Medical Clearance" - the Vet half is recorded
  // automatically when a Veterinarian issues a Medical Clearance.
  vetConfirmationNote?: string;
}

export function isFitnessReviewComplete(review: FitnessReview | undefined): boolean {
  return Boolean(review?.staffConfirmedAt && review?.vetConfirmedAt);
}

// PRD: if there is an unresolved Statutory Hold, an incomplete health
// check or an incomplete behaviour assessment, list them as blockers.
export function getFitnessBlockers(animal: Animal, tasks: AssessmentTask[]): string[] {
  const blockers: string[] = [];
  for (const type of TASK_TYPES) {
    const task = tasks.find((t) => t.taskType === type);
    if (!task || task.status !== "Continuable") {
      blockers.push(`${type} has not reached a continuable state.`);
    }
  }
  if (animal.currentStatus === "On Statutory Hold") {
    blockers.push("There is an unresolved Statutory Hold on this animal.");
  }
  return blockers;
}
