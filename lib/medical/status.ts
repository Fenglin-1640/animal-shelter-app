import type { StatusCategory } from "@/lib/shared/status-category";
import type { DesexingStatus } from "@/lib/medical/types";

export const DESEXING_STATUS_CATEGORY: Record<DesexingStatus, StatusCategory> = {
  Scheduled: "caution",
  Completed: "success",
};
