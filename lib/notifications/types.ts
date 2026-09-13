import type { Role } from "@/lib/roles/roles";

// The 9 notification-triggering events from PRD FR-NOT-01.
export type NotificationType =
  | "Statutory Hold"
  | "Behaviour Reassessment"
  | "Vaccine Booster"
  | "Desexing Appointment"
  | "Application Decision"
  | "Meet and Greet"
  | "Pre-Release Check"
  | "Follow Up Visit"
  | "Backup Job";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "Statutory Hold",
  "Behaviour Reassessment",
  "Vaccine Booster",
  "Desexing Appointment",
  "Application Decision",
  "Meet and Greet",
  "Pre-Release Check",
  "Follow Up Visit",
  "Backup Job",
];

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  createdAt: string;
  dueDate?: string;
  roles: Role[];
  defaultRead: boolean;
}
