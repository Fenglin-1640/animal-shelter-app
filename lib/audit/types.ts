// FR-AUD-01 / PRD 8.2 AuditLog fields: auditId、userId、timestamp、action、
// entityType、entityId、oldValue、newValue、result. Immutable - nothing in
// this codebase ever edits or deletes an entry once written (BR-013).
export type AuditEntityType =
  | "Animal"
  | "MedicalRecord"
  | "StatutoryHold"
  | "IntakeRecord"
  | "UserAccount"
  | "FollowUpVisit"
  | "SystemSetting";

export interface AuditLogEntry {
  auditId: string;
  userId: string;
  userName: string;
  timestamp: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  oldValue: string;
  newValue: string;
  result: "Success" | "Failure";
}

// Used for transitions this prototype resolves lazily with no direct
// human actor at that instant (e.g. Statutory Hold expiry, evaluated on
// next read rather than by a scheduler).
export const SYSTEM_ACTOR = { email: "system", name: "System (automatic)" };
