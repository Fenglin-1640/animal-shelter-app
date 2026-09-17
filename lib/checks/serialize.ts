import type { CheckOutcome, CheckType, SuitabilityCheck } from "@/lib/checks/types";

// Server-side row shape returned by the Prisma 8 contract client (see
// prisma/contract.prisma) - checkType/outcome are generic String
// columns, not narrowed to their domain union types.
export interface SuitabilityCheckRow
  extends Omit<SuitabilityCheck, "checkType" | "outcome" | "conductedDate" | "completedByEmail" | "completedByName"> {
  checkType: string;
  outcome: string;
  conductedDate: string | null;
  completedByEmail: string | null;
  completedByName: string | null;
}

export function toSuitabilityCheck(row: SuitabilityCheckRow): SuitabilityCheck {
  return {
    ...row,
    checkType: row.checkType as CheckType,
    outcome: row.outcome as CheckOutcome,
    conductedDate: row.conductedDate ?? undefined,
    completedByEmail: row.completedByEmail ?? undefined,
    completedByName: row.completedByName ?? undefined,
  };
}
