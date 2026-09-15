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
  // When set, this notification is personal to one account (e.g. an
  // Adopter's own application decision) rather than visible to every
  // signed-in user whose role matches `roles` - the Notifications screen
  // additionally filters on this against the signed-in user's email.
  recipientEmail?: string;
  defaultRead: boolean;
}
