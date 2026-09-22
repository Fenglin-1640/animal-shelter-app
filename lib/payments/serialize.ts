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
  paymentDate: string;
  paymentStatus: string;
  receiptNumber: string | null;
  verifiedByEmail: string | null;
  verifiedByName: string | null;
  verifiedDate: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toAdoptionPayment(row: AdoptionPaymentRow): AdoptionPayment {
  return {
    ...row,
    animalSpecies: row.animalSpecies as Species,
    paymentDate: row.paymentDate,
    paymentStatus: row.paymentStatus as PaymentStatus,
    receiptNumber: row.receiptNumber ?? undefined,
    verifiedByEmail: row.verifiedByEmail ?? undefined,
    verifiedByName: row.verifiedByName ?? undefined,
    verifiedDate: row.verifiedDate ?? undefined,
    failureReason: row.failureReason ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPaymentRowPatch(patch: Partial<AdoptionPayment>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    row[key] = value;
  }
  return row;
}
