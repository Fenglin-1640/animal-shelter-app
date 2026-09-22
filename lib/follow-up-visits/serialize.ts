import type { FollowUpType, FollowUpVisit, FollowUpVisitStatus, WelfareOutcome } from "@/lib/follow-up-visits/types";

export interface FollowUpVisitRow
  extends Omit<
    FollowUpVisit,
    | "careInstructionsProvided"
    | "followUpType"
    | "status"
    | "outcome"
    | "completedByEmail"
    | "completedByName"
    | "completedAt"
    | "createdAt"
  > {
  careInstructionsProvided: number;
  followUpType: string;
  status: string;
  outcome: string | null;
  completedByEmail: string | null;
  completedByName: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function toFollowUpVisit(row: FollowUpVisitRow): FollowUpVisit {
  return {
    ...row,
    careInstructionsProvided: row.careInstructionsProvided === 1,
    followUpType: row.followUpType as FollowUpType,
    status: row.status as FollowUpVisitStatus,
    outcome: (row.outcome as WelfareOutcome | null) ?? undefined,
    completedByEmail: row.completedByEmail ?? undefined,
    completedByName: row.completedByName ?? undefined,
    completedAt: row.completedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

export function toFollowUpVisitRowPatch(patch: Partial<FollowUpVisit>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "careInstructionsProvided") {
      row[key] = value ? 1 : 0;
    } else {
      row[key] = value;
    }
  }
  return row;
}
