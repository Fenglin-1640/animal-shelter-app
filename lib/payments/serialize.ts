import type { Species } from "@/lib/animals/types";
import type { AdoptionPayment, PaymentStatus } from "@/lib/payments/types";

export interface AdoptionPaymentRow
  extends Omit<
    AdoptionPayment,
    | "animalSpecies"
    | "paymentDate"
    | "paymentStatus"
    | "receiptNumber"
    | "verifiedByEmail"
    | "verifiedByName"
    | "verifiedDate"
    | "failureReason"
    | "createdAt"
    | "updatedAt"
  > {
  animalSpecies: string;
  paymentDate: Date;
  paymentStatus: string;
  receiptNumber: string | null;
  verifiedByEmail: string | null;
  verifiedByName: string | null;
  verifiedDate: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAdoptionPayment(row: AdoptionPaymentRow): AdoptionPayment {
  return {
    ...row,
    animalSpecies: row.animalSpecies as Species,
    paymentDate: row.paymentDate.toISOString(),
    paymentStatus: row.paymentStatus as PaymentStatus,
    receiptNumber: row.receiptNumber ?? undefined,
    verifiedByEmail: row.verifiedByEmail ?? undefined,
    verifiedByName: row.verifiedByName ?? undefined,
    verifiedDate: row.verifiedDate?.toISOString(),
    failureReason: row.failureReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPaymentRowPatch(patch: Partial<AdoptionPayment>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "paymentDate" || key === "verifiedDate" || key === "createdAt" || key === "updatedAt") {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else {
      row[key] = value;
    }
  }
  return row;
}
