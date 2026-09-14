import type { StatusCategory } from "@/lib/shared/status-category";
import type { BehaviourOutcome, BehaviourProgramStatus } from "@/lib/behaviour/types";

export const OUTCOME_CATEGORY: Record<BehaviourOutcome, StatusCategory> = {
  "Suitable for Adoption": "success",
  "Requires Behaviour Modification": "caution",
  "Unsuitable for Public Adoption": "attention",
};

export const PROGRAM_STATUS_CATEGORY: Record<BehaviourProgramStatus, StatusCategory> = {
  Active: "progress",
  "Completed - Suitable": "success",
  "Completed - Permanently Unsuitable": "neutral",
};
