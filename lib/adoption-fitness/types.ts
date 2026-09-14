import type { Animal } from "@/lib/animals/types";

// FR-INT-04: the three tasks created in parallel once Finalise Intake
// (FR-INT-03) runs. Recording each task's full result is the job of its
// own dedicated FR - Scan Microchip (FR-MC-01/02), Health Assessment
// (FR-MED-01), Temperament Assessment (FR-BEH-01) - none of which are
// built yet. This module only tracks whether each track has reached the
// "continuable" state BR-016 requires before Review Adoption Fitness is
// allowed; "Mark Continuable" here is a scoped stand-in for that not-yet
// -built detailed recording, same as FR-INT-03's photo capture stood in
// for full FR-AN-02 Photo management.
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

// "共同确认" - the joint Shelter Staff Member + Veterinarian confirmation.
// Review Adoption Fitness itself does not change Animal.currentStatus -
// no PRD text ties a status transition to this confirmation (Publish
// Adoption Profile, FR-LIST-01, is what sets Available For Adoption; PRD
// 12.1's Ruby stays Under Assessment/Pre-Listing even once Vet-cleared).
export interface FitnessReview {
  animalId: string;
  staffConfirmedByEmail?: string;
  staffConfirmedByName?: string;
  staffConfirmedAt?: string;
  vetConfirmedByEmail?: string;
  vetConfirmedByName?: string;
  vetConfirmedAt?: string;
}

export function isFitnessReviewComplete(review: FitnessReview | undefined): boolean {
  return Boolean(review?.staffConfirmedAt && review?.vetConfirmedAt);
}

// PRD: "若存在未结束的 Statutory Hold、未完成的健康检查或未完成的行为评估，系统必须列出阻塞项。"
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
