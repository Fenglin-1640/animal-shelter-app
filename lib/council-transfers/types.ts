// FR-INT-01 / PRD 8.3 CouncilTransferSubmission. "Accepted" and
// "Returned for Information" are Staff-side decisions (FR-INT-02, not
// built yet) - reachable in the type for forward compatibility, but
// nothing in this codebase sets them yet.
export type TransferStatus = "Draft" | "Submitted" | "Accepted" | "Returned for Information";

// File content isn't persisted (no backend / no durable file storage in
// this prototype) - only the metadata a real DocumentAttachment would
// carry, sourced from System Administration's "Document Type" category.
export interface TransferAttachment {
  id: string;
  documentType: string;
  fileName: string;
  fileSizeKB: number;
  uploadedAt: string;
}

export interface CouncilTransferSubmission {
  id: string;
  submittedByEmail: string;
  submittedByName: string;
  source: string;
  arrivalCircumstance: string;
  foundLocation: string;
  animalDescription: string;
  attachments: TransferAttachment[];
  status: TransferStatus;
  submissionDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferFormInput {
  source: string;
  arrivalCircumstance: string;
  foundLocation: string;
  animalDescription: string;
  attachments: TransferAttachment[];
}
