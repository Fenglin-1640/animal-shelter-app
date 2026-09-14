import { getAnimalById } from "@/lib/animals/animal-store";
import { writeAuditLog } from "@/lib/audit/store";
import { getAgreement } from "@/lib/agreements/store";
import type { AdoptionPayment, PaymentStatus } from "@/lib/payments/types";

// FR-PAY-01: AdoptionPayment records, persisted to localStorage since
// there is no backend. There is no real payment gateway - "Adopter 可发起
// 模拟付款" is implemented as: Adopter submits a simulated payment
// (status Pending), Staff/Administrator then verify it (status Cleared,
// with a receipt number) or mark it Failed - matching "Staff 可记录或验证
// 付款结果" and giving both PRD-named actions a real, distinct action.
const STORAGE_KEY = "asams-payments";

function loadAll(): AdoptionPayment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdoptionPayment[]) : [];
  } catch {
    return [];
  }
}

function saveAll(all: AdoptionPayment[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function generatePaymentId(): string {
  return `PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateReceiptNumber(): string {
  return `RCPT-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
}

export function listPaymentsForAgreement(agreementId: string): AdoptionPayment[] {
  return loadAll()
    .filter((p) => p.agreementId === agreementId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// The most recent attempt - a new attempt can only be initiated once the
// prior one is Failed (or none exists yet), so this is unambiguous.
export function getLatestPaymentForAgreement(agreementId: string): AdoptionPayment | undefined {
  return listPaymentsForAgreement(agreementId)[0];
}

export function getPayment(paymentId: string): AdoptionPayment | undefined {
  return loadAll().find((p) => p.paymentId === paymentId);
}

export type MutationResult = { ok: true; paymentId?: string } | { ok: false; reason: string };

// PRD 6.13: "Adopter 可发起模拟付款." amount defaults to the Animal's
// adoptionFee (read-only in the UI) since PRD names no other source of
// truth for the amount owed.
export function initiatePayment(
  agreementId: string,
  paymentMethod: string,
  email: string,
  name: string,
): MutationResult {
  const agreement = getAgreement(agreementId);
  if (!agreement) return { ok: false, reason: "not_found" };

  // PRD 6.13: "Agreement 签署和 Payment 处理可以并行完成，系统不得强制两者的先后顺序" -
  // payment can be initiated as soon as an agreement exists, whether or
  // not it is signed yet.
  const existing = getLatestPaymentForAgreement(agreementId);
  if (existing && existing.paymentStatus !== "Failed") {
    return { ok: false, reason: "already_in_progress" };
  }

  const animal = getAnimalById(agreement.animalId);
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
  saveAll([...loadAll(), payment]);

  writeAuditLog({
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
export function verifyPayment(
  paymentId: string,
  outcome: Extract<PaymentStatus, "Cleared" | "Failed">,
  email: string,
  name: string,
  failureReason?: string,
): MutationResult {
  const all = loadAll();
  const index = all.findIndex((p) => p.paymentId === paymentId);
  if (index === -1) return { ok: false, reason: "not_found" };
  if (all[index].paymentStatus !== "Pending") return { ok: false, reason: "not_pending" };
  if (outcome === "Failed" && !failureReason?.trim()) return { ok: false, reason: "reason_required" };

  const now = new Date().toISOString();
  const payment = all[index];
  all[index] = {
    ...payment,
    paymentStatus: outcome,
    receiptNumber: outcome === "Cleared" ? generateReceiptNumber() : undefined,
    verifiedByEmail: email,
    verifiedByName: name,
    verifiedDate: now,
    failureReason: outcome === "Failed" ? failureReason?.trim() : undefined,
    updatedAt: now,
  };
  saveAll(all);

  writeAuditLog({
    userId: email,
    userName: name,
    action: "Verify Adoption Payment",
    entityType: "Animal",
    entityId: payment.animalId,
    oldValue: `paymentId=${paymentId}, applicationId=${payment.applicationId}`,
    newValue: outcome === "Cleared" ? `Cleared, receipt=${all[index].receiptNumber}` : `Failed: ${failureReason?.trim()}`,
    result: "Success",
  });

  return { ok: true };
}
