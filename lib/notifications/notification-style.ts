import type { NotificationType } from "@/lib/notifications/types";

// Maps each notification type to a PRD 5.8.3 status category. Chip
// backgrounds are tinted (never solid) so the always-neutral text keeps
// AA contrast; color is a reinforcing signal, never the only one (5.8.3).
export type StatusCategory = "caution" | "progress" | "attention";

export const CATEGORY_STYLE: Record<
  StatusCategory,
  { border: string; background: string; icon: string }
> = {
  caution: {
    border: "border-gold",
    background: "bg-gold/15",
    icon: "text-gold",
  },
  progress: {
    border: "border-secondary",
    background: "bg-secondary/15",
    icon: "text-secondary",
  },
  attention: {
    border: "border-danger",
    background: "bg-danger/15",
    icon: "text-danger",
  },
};

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
