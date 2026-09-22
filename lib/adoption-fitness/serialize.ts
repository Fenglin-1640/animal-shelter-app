import type { AssessmentTask, FitnessReview, TaskStatus, TaskType } from "@/lib/adoption-fitness/types";

export interface AssessmentTaskRow
  extends Omit<AssessmentTask, "taskType" | "status" | "markedByEmail" | "markedByName" | "markedAt"> {
  taskType: string;
  status: string;
  markedByEmail: string | null;
  markedByName: string | null;
  markedAt: string | null;
}

export function toAssessmentTask(row: AssessmentTaskRow): AssessmentTask {
  return {
    ...row,
    taskType: row.taskType as TaskType,
    status: row.status as TaskStatus,
    markedByEmail: row.markedByEmail ?? undefined,
    markedByName: row.markedByName ?? undefined,
    markedAt: row.markedAt ?? undefined,
  };
}

export interface FitnessReviewRow
  extends Omit<
    FitnessReview,
    | "staffConfirmedByEmail"
    | "staffConfirmedByName"
    | "staffConfirmedAt"
    | "vetConfirmedByEmail"
    | "vetConfirmedByName"
    | "vetConfirmedAt"
  > {
  staffConfirmedByEmail: string | null;
  staffConfirmedByName: string | null;
  staffConfirmedAt: string | null;
  vetConfirmedByEmail: string | null;
  vetConfirmedByName: string | null;
  vetConfirmedAt: string | null;
}

export function toFitnessReview(row: FitnessReviewRow): FitnessReview {
  return {
    ...row,
    staffConfirmedByEmail: row.staffConfirmedByEmail ?? undefined,
    staffConfirmedByName: row.staffConfirmedByName ?? undefined,
    staffConfirmedAt: row.staffConfirmedAt ?? undefined,
    vetConfirmedByEmail: row.vetConfirmedByEmail ?? undefined,
    vetConfirmedByName: row.vetConfirmedByName ?? undefined,
    vetConfirmedAt: row.vetConfirmedAt ?? undefined,
  };
}
