import type { NotificationItem } from "@/lib/notifications/types";

// Sample data only for "Backup Job failure" - the one FR-NOT-01 event
// type (lib/notifications/store.ts) that stays simulated. PRD 8.3 frames
// BackupRun/RecoveryTest as "原型中的备份状态与恢复测试证据" (prototype evidence
// of backup status), not a real subsystem: this client-side/localStorage
// prototype has no actual backup job to succeed or fail, so there is no
// real event to compute this notification from - unlike the other 8
// types, which are now all dynamically derived from real feature data.
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function getMockNotifications(): NotificationItem[] {
  return [
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
