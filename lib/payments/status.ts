import type { StatusCategory } from "@/lib/shared/status-category";
import type { PaymentStatus } from "@/lib/payments/types";

export const PAYMENT_STATUS_CATEGORY: Record<PaymentStatus, StatusCategory> = {
  Pending: "caution",
  Cleared: "success",
  Failed: "attention",
};
