import { getAnimalById } from "@/lib/animals/animal-store";
import { writeAuditLog } from "@/lib/audit/store";
import { getAgreement } from "@/lib/agreements/store";
import type { AdoptionPayment, PaymentStatus } from "@/lib/payments/types";

// FR-PAY-01: AdoptionPayment now lives in the database (see
// prisma/contract.prisma) behind /api/payments - see prisma/README.md
// for this Prisma toolchain's quirks. There is no real payment gateway
// - "Adopter 可发起模拟付款" is implemented as: Adopter submits a simulated
// payment (status Pending), Staff/Administrator then verify it (status
// Cleared, with a receipt number) or mark it Failed - matching "Staff
// 可记录或验证付款结果" and giving both PRD-named actions a real, distinct
// action.

async function fetchAll(): Promise<AdoptionPayment[]> {
  const response = await fetch("/api/payments");
  const result = await response.json();
  return result.items as AdoptionPayment[];
}

function generatePaymentId(): string {
  return `PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateReceiptNumber(): string {
  return `RCPT-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
}

export async function listPaymentsForAgreement(agreementId: string): Promise<AdoptionPayment[]> {
  return (await fetchAll())
    .filter((p) => p.agreementId === agreementId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// The most recent attempt - a new attempt can only be initiated once the
// prior one is Failed (or none exists yet), so this is unambiguous.
export async function getLatestPaymentForAgreement(agreementId: string): Promise<AdoptionPayment | undefined> {
  return (await listPaymentsForAgreement(agreementId))[0];
}

export async function getPayment(paymentId: string): Promise<AdoptionPayment | undefined> {
  return (await fetchAll()).find((p) => p.paymentId === paymentId);
}

export type MutationResult = { ok: true; paymentId?: string } | { ok: false; reason: string };

// PRD 6.13: "Adopter 可发起模拟付款." amount defaults to the Animal's
// adoptionFee (read-only in the UI) since PRD names no other source of
// truth for the amount owed.
export async function initiatePayment(
  agreementId: string,
  paymentMethod: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const agreement = await getAgreement(agreementId);
  if (!agreement) return { ok: false, reason: "not_found" };

  // PRD 6.13: "Agreement 签署和 Payment 处理可以并行完成，系统不得强制两者的先后顺序" -
  // payment can be initiated as soon as an agreement exists, whether or
  // not it is signed yet.
  const existing = await getLatestPaymentForAgreement(agreementId);
  if (existing && existing.paymentStatus !== "Failed") {
    return { ok: false, reason: "already_in_progress" };
  }

  const animal = await getAnimalById(agreement.animalId);
  const amount = animal?.adoptionFee ?? 0;

  const now = new Date().toISOString();
  const payment: AdoptionPayment = {
    paymentId: generatePaymentId(),
    agreementId,
    applicationId: agreement.applicationId,
    animalId: agreement.animalId,
    animalName: agreement.animalName,
    animalSpecies: agreement.animalSpecies,
    adopterEmail: agreement.adopterEmail,
    adopterName: agreement.adopterName,
    amount,
    paymentMethod,
    paymentDate: now,
    paymentStatus: "Pending",
    createdAt: now,
    updatedAt: now,
  };
  await fetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payment),
  });

  await writeAuditLog({
    userId: email,
    userName: name,
    action: "Initiate Simulated Adoption Payment",
    entityType: "Animal",
    entityId: agreement.animalId,
    oldValue: `agreementId=${agreementId}, applicationId=${agreement.applicationId}`,
    newValue: `paymentId=${payment.paymentId}, amount=${amount}, method=${paymentMethod}`,
    result: "Success",
  });

  return { ok: true, paymentId: payment.paymentId };
}

// PRD 6.13: "Staff 可记录或验证付款结果...成功后可生成 receipt."
export async function verifyPayment(
  paymentId: string,
  outcome: Extract<PaymentStatus, "Cleared" | "Failed">,
  email: string,
  name: string,
  failureReason?: string,
): Promise<MutationResult> {
  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, reason: "not_found" };
  if (payment.paymentStatus !== "Pending") return { ok: false, reason: "not_pending" };
  if (outcome === "Failed" && !failureReason?.trim()) return { ok: false, reason: "reason_required" };

  const now = new Date().toISOString();
  const response = await fetch(`/api/payments/${paymentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentStatus: outcome,
      receiptNumber: outcome === "Cleared" ? generateReceiptNumber() : null,
      verifiedByEmail: email,
      verifiedByName: name,
      verifiedDate: now,
      failureReason: outcome === "Failed" ? failureReason?.trim() : null,
      updatedAt: now,
    }),
  });
  const result = await response.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };

  await writeAuditLog({
    userId: email,
    userName: name,
    action: "Verify Adoption Payment",
    entityType: "Animal",
    entityId: payment.animalId,
    oldValue: `paymentId=${paymentId}, applicationId=${payment.applicationId}`,
    newValue: outcome === "Cleared" ? `Cleared, receipt=${result.item.receiptNumber}` : `Failed: ${failureReason?.trim()}`,
    result: "Success",
  });

  return { ok: true };
}
