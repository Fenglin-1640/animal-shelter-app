import type { NotificationItem } from "@/lib/notifications/types";

// Sample data only: the underlying business features (intake, medical,
// behaviour, adoption workflow) that would generate these events for real
// haven't been built yet. Dates are relative to "now" so the list always
// reads as current whenever the prototype is opened.
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function getMockNotifications(): NotificationItem[] {
  return [
    {
      id: "hold-bella",
      type: "Statutory Hold",
      title: "Statutory hold ending soon",
      detail:
        "Bella's statutory hold ends in 2 days. Confirm owner reclamation or return her to assessment.",
      createdAt: daysFromNow(-1),
      dueDate: daysFromNow(2),
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: false,
    },
    {
      id: "reassessment-coco",
      type: "Behaviour Reassessment",
      title: "Behaviour reassessment due",
      detail:
        "Coco is due for a behaviour reassessment following her Behaviour Program.",
      createdAt: daysFromNow(-2),
      dueDate: daysFromNow(3),
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: false,
    },
    {
      id: "vaccine-milo",
      type: "Vaccine Booster",
      title: "Vaccine booster due",
      detail: "Milo's vaccine booster is due this week.",
      createdAt: daysFromNow(-1),
      dueDate: daysFromNow(4),
      roles: ["Veterinarian", "Administrator"],
      defaultRead: false,
    },
    {
      id: "desexing-ruby",
      type: "Desexing Appointment",
      title: "Desexing appointment scheduled",
      detail: "Ruby's desexing appointment is scheduled for Friday.",
      createdAt: daysFromNow(-3),
      dueDate: daysFromNow(5),
      roles: ["Veterinarian", "Administrator"],
      defaultRead: true,
    },
    {
      id: "decision-luna-approved",
      type: "Application Decision",
      title: "Your application was approved",
      detail:
        "Your adoption application for Luna has been approved. Next step: schedule a Meet and Greet.",
      createdAt: daysFromNow(-4),
      roles: ["Adopter"],
      defaultRead: false,
    },
    {
      id: "decision-charlie-rejected",
      type: "Application Decision",
      title: "Update on your application",
      detail:
        "Your adoption application for Charlie was not successful. View details for more information.",
      createdAt: daysFromNow(-9),
      roles: ["Adopter"],
      defaultRead: true,
    },
    {
      id: "meet-and-greet-staff",
      type: "Meet and Greet",
      title: "Meet and Greet scheduled",
      detail:
        "Meet and Greet with Jordan Taylor for Luna is scheduled for Saturday, 10:00 AM.",
      createdAt: daysFromNow(-1),
      dueDate: daysFromNow(3),
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: false,
    },
    {
      id: "meet-and-greet-adopter",
      type: "Meet and Greet",
      title: "Your Meet and Greet is scheduled",
      detail: "Your Meet and Greet for Luna is scheduled for Saturday, 10:00 AM.",
      createdAt: daysFromNow(-1),
      dueDate: daysFromNow(3),
      roles: ["Adopter"],
      defaultRead: false,
    },
    {
      id: "pre-release-daisy",
      type: "Pre-Release Check",
      title: "Pre-Release Check required",
      detail:
        "Daisy is awaiting a Pre-Release Check before she can be released to her adopter.",
      createdAt: daysFromNow(-2),
      dueDate: daysFromNow(1),
      roles: ["Veterinarian", "Administrator"],
      defaultRead: false,
    },
    {
      id: "follow-up-oliver",
      type: "Follow Up Visit",
      title: "Follow up visit due",
      detail: "A phone call follow-up for Oliver is due this week.",
      createdAt: daysFromNow(-5),
      dueDate: daysFromNow(2),
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: true,
    },
    {
      id: "backup-failure",
      type: "Backup Job",
      title: "Backup job failed",
      detail:
        "Last night's incremental backup job failed. Review Retention and Backup Status for details.",
      createdAt: daysFromNow(0),
      roles: ["Administrator"],
      defaultRead: false,
    },
  ];
}
