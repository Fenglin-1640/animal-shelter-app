import type { CouncilTransferSubmission, TransferAttachment, TransferStatus } from "@/lib/council-transfers/types";

export interface CouncilTransferSubmissionRow
  extends Omit<
    CouncilTransferSubmission,
    "attachments" | "status" | "submissionDate" | "createdAt" | "updatedAt"
  > {
  attachments: string;
  status: string;
  submissionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toCouncilTransferSubmission(row: CouncilTransferSubmissionRow): CouncilTransferSubmission {
  return {
    ...row,
    attachments: JSON.parse(row.attachments) as TransferAttachment[],
    status: row.status as TransferStatus,
    submissionDate: row.submissionDate ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toTransferRowPatch(patch: Partial<CouncilTransferSubmission>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "attachments") {
      row[key] = JSON.stringify(value);
    } else {
      row[key] = value;
    }
  }
  return row;
}
