import type { CurrentStatus, ListingStatus } from "@/lib/animals/types";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import type { StepState } from "@/lib/process/engine";

// What a Council Officer may see about the animal created from one of
// their own transfers. A fixed whitelist: no adopter identity or contact,
// application, medical, fee, note or audit data.
export interface TransferAnimalSummary {
  name: string;
  species: string;
  breed: string;
  shelterId: string;
  currentStatus: CurrentStatus;
  listingStatus: ListingStatus;
  // Signed, cached image URL of the public photo (or the first photo).
  thumbnailUrl?: string;
  thumbnailAlt: string;
}

export interface TransferMilestone {
  key: "received" | "clearance" | "published" | "adopted" | "follow_up" | "rehomed";
  label: string;
  reached: boolean;
  // Omitted when the record holds no date for it.
  date?: string;
}

export type TransferStep = { label: string; state: StepState; detail: string; waitingOn?: string };

export interface TransferProgress {
  steps: TransferStep[];
  animal: TransferAnimalSummary | null;
  milestones: TransferMilestone[];
  outcome: { label: string; date?: string } | null;
}

export interface TransferWithProgress extends TransferProgress {
  transfer: CouncilTransferSubmission;
}

const STATUS_LABEL: Partial<Record<CurrentStatus, string>> = {
  inFollowUpPeriod: "In follow-up period",
  ReturnedToOwner: "Returned to owner",
  "Reclaimed By Owner": "Reclaimed by owner",
};

// Readable animal status for Council views.
export function animalStatusLabel(status: CurrentStatus): string {
  return STATUS_LABEL[status] ?? status;
}
