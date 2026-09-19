// FR-REC-01 / PRD 8.3: "BackupRun and RecoveryTest | 原型中的备份状态与恢复测试证据"
// - PRD itself frames these as prototype evidence of backup status, not
// a real subsystem. This prototype has no actual backup subsystem
// (scheduled backups, offsite storage, recovery testing) to run, so
// this data is simulated and disclosed as such wherever shown - the
// same status as the "Backup Job failure" Notification type
// (lib/notifications/mock-notifications.ts), which this data is
// written to match (one Failed run "last night").
export interface BackupRun {
  id: string;
  ranAt: string;
  type: "Full" | "Incremental";
  status: "Success" | "Failed";
  notes: string;
}

export interface RecoveryTest {
  id: string;
  testedAt: string;
  result: "Passed" | "Failed";
  notes: string;
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function getBackupRuns(): BackupRun[] {
  return [
    { id: "BK-001", ranAt: daysFromNow(0), type: "Incremental", status: "Failed", notes: "Storage volume unreachable - retried automatically at next scheduled run." },
    { id: "BK-002", ranAt: daysFromNow(-1), type: "Incremental", status: "Success", notes: "" },
    { id: "BK-003", ranAt: daysFromNow(-2), type: "Incremental", status: "Success", notes: "" },
    { id: "BK-004", ranAt: daysFromNow(-7), type: "Full", status: "Success", notes: "Weekly full backup." },
    { id: "BK-005", ranAt: daysFromNow(-8), type: "Incremental", status: "Success", notes: "" },
  ];
}

export function getRecoveryTests(): RecoveryTest[] {
  return [
    { id: "RT-001", testedAt: daysFromNow(-14), result: "Passed", notes: "Quarterly restore drill against the previous full backup." },
  ];
}
