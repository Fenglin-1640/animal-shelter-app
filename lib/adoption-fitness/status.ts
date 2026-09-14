import type { StatusCategory } from "@/lib/shared/status-category";
import type { TaskStatus } from "@/lib/adoption-fitness/types";

export const TASK_STATUS_CATEGORY: Record<TaskStatus, StatusCategory> = {
  Pending: "caution",
  Continuable: "success",
};
