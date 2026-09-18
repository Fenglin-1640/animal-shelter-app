import type { CouncilTransferSubmission, TransferAttachment, TransferStatus } from "@/lib/council-transfers/types";

export interface CouncilTransferSubmissionRow
  extends Omit<
    CouncilTransferSubmission,
    "attachments" | "status" | "submissionDate" | "createdAt" | "updatedAt"
  > {
  attachments: string;
  status: string;
  submissionDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toCouncilTransferSubmission(row: CouncilTransferSubmissionRow): CouncilTransferSubmission {
  return {
    ...row,
    attachments: JSON.parse(row.attachments) as TransferAttachment[],
    status: row.status as TransferStatus,
    submissionDate: row.submissionDate?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTransferRowPatch(patch: Partial<CouncilTransferSubmission>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "attachments") {
      row[key] = JSON.stringify(value);
    } else if (key === "submissionDate" || key === "createdAt" || key === "updatedAt") {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else {
      row[key] = value;
    }
  }
  return row;
}
