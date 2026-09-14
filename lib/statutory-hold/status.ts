import type { StatusCategory } from "@/lib/shared/status-category";
import type { StatutoryHoldStatus } from "@/lib/statutory-hold/types";

export const HOLD_STATUS_CATEGORY: Record<StatutoryHoldStatus, StatusCategory> = {
  Active: "caution",
  "Reclaimed By Owner": "progress",
  Expired: "neutral",
};
