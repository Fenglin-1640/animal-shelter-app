import type { StatusCategory } from "@/lib/shared/status-category";

export const USER_STATUS_CATEGORY: Record<"Active" | "Inactive" | "Locked", StatusCategory> = {
  Active: "success",
  Inactive: "neutral",
  Locked: "attention",
};
