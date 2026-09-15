import type { StatusCategory } from "@/lib/shared/status-category";
import type { FollowUpVisitStatus, WelfareOutcome } from "@/lib/follow-up-visits/types";

export const FOLLOW_UP_VISIT_STATUS_CATEGORY: Record<FollowUpVisitStatus, StatusCategory> = {
  Scheduled: "progress",
  Completed: "complete",
};

export const WELFARE_OUTCOME_CATEGORY: Record<WelfareOutcome, StatusCategory> = {
  "Settling Well": "success",
  "Concerns Noted": "caution",
  "Unable to Contact Adopter": "attention",
};
