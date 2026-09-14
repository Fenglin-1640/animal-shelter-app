import type { StatusCategory } from "@/lib/shared/status-category";

export const OPTION_STATUS_CATEGORY: Record<"Active" | "Retired", StatusCategory> = {
  Active: "success",
  Retired: "neutral",
};
