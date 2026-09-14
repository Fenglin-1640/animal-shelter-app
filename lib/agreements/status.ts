import type { StatusCategory } from "@/lib/shared/status-category";
import type { AgreementStatus } from "@/lib/agreements/types";

export const AGREEMENT_STATUS_CATEGORY: Record<AgreementStatus, StatusCategory> = {
  "Pending Signature": "caution",
  Signed: "success",
};

export function getAgreementStatus(isSigned: boolean): AgreementStatus {
  return isSigned ? "Signed" : "Pending Signature";
}
