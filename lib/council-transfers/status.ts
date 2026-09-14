import type { StatusCategory } from "@/lib/shared/status-category";
import type { TransferStatus } from "@/lib/council-transfers/types";

export const TRANSFER_STATUS_CATEGORY: Record<TransferStatus, StatusCategory> = {
  Draft: "neutral",
  Submitted: "progress",
  Accepted: "success",
  "Returned for Information": "caution",
};
