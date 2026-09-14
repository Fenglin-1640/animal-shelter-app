import type { StatusCategory } from "@/lib/shared/status-category";
import type { MicrochipLookupResult } from "@/lib/microchip/types";

export const LOOKUP_RESULT_CATEGORY: Record<MicrochipLookupResult, StatusCategory> = {
  "Owner Match": "caution",
  "No Match": "neutral",
  "No Chip": "neutral",
  Timeout: "attention",
};
