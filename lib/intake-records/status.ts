import type { StatusCategory } from "@/lib/shared/status-category";

export const INTAKE_COMPLETENESS_CATEGORY: Record<"Complete" | "Incomplete", StatusCategory> = {
  Complete: "success",
  Incomplete: "caution",
};
