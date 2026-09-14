import type { StatusCategory } from "@/lib/shared/status-category";
import type { ApplicationStatus } from "@/lib/applications/types";

export const APPLICATION_STATUS_CATEGORY: Record<ApplicationStatus, StatusCategory> = {
  Draft: "neutral",
  Submitted: "progress",
  "Under Review": "progress",
  "On Hold": "caution",
  Approved: "success",
  Rejected: "attention",
  Finalised: "complete",
};
