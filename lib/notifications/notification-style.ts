import type { StatusCategory } from "@/lib/shared/status-category";
import type { NotificationType } from "@/lib/notifications/types";

export const NOTIFICATION_CATEGORY: Record<NotificationType, StatusCategory> = {
  "Statutory Hold": "caution",
  "Behaviour Reassessment": "caution",
  "Vaccine Booster": "caution",
  "Desexing Appointment": "caution",
  "Pre-Release Check": "caution",
  "Follow Up Visit": "caution",
  "Application Decision": "progress",
  "Meet and Greet": "progress",
  "Backup Job": "attention",
};
