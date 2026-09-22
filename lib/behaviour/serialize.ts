import type { BehaviourOutcome, BehaviourProgram, TemperamentAssessment } from "@/lib/behaviour/types";

// Server-side row shapes returned by the Prisma 8 contract client (see
// prisma/contract.prisma). followUpRequired is Int (0/1), not Boolean -
// this SQL PSL provider doesn't support the Boolean field type. outcome
// is a generic String column, not narrowed to BehaviourOutcome.

export interface TemperamentAssessmentRow
  extends Omit<
    TemperamentAssessment,
    "createdAt" | "followUpRequired" | "outcome" | "reassessmentDate" | "programReassessmentOf"
  > {
  followUpRequired: number;
  outcome: string;
  reassessmentDate: string | null;
  programReassessmentOf: string | null;
  createdAt: string;
}
export function toTemperamentAssessment(row: TemperamentAssessmentRow): TemperamentAssessment {
  return {
    ...row,
    followUpRequired: Boolean(row.followUpRequired),
    outcome: row.outcome as BehaviourOutcome,
    createdAt: row.createdAt,
    reassessmentDate: row.reassessmentDate ?? undefined,
    programReassessmentOf: row.programReassessmentOf ?? undefined,
  };
}

export interface BehaviourProgramRow
  extends Omit<BehaviourProgram, "createdAt" | "resolvedAt" | "status"> {
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}
export function toBehaviourProgram(row: BehaviourProgramRow): BehaviourProgram {
  return {
    ...row,
    status: row.status as BehaviourProgram["status"],
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? undefined,
  };
}
