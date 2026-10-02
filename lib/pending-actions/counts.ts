import type { Animal } from "@/lib/animals/types";
import type { AdoptionApplication } from "@/lib/applications/types";
import { CHECK_TYPES, type SuitabilityCheck } from "@/lib/checks/types";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import type { PreReleaseCheck } from "@/lib/medical/types";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";
import type { AdoptionPayment } from "@/lib/payments/types";
import { ROLE_FUNCTIONS, type Role } from "@/lib/roles/roles";

// Sidebar badge counts (RoleSidebar) - each counts items concretely,
// individually actionable by the signed-in user right now. A nav label
// with no entry here never shows a badge: "pending" must be a
// well-defined, actionable state, not just "new data exists" on that
// screen. Pure functions over already-loaded records, so the
// /api/pending-counts route can compute them server-side and return
// only numbers instead of every client downloading whole collections.

export const PENDING_COUNT_LABELS = [
  "Adoptions",
  "Adoption Applications",
  "Animal Intake",
  "Pre-Release Checks",
  "My Meet and Greets",
] as const;

export type PendingCountLabel = (typeof PENDING_COUNT_LABELS)[number];

// The badge labels present in a role's sidebar.
export function pendingCountLabelsForRole(role: Role): PendingCountLabel[] {
  const navLabels = new Set(
    [...ROLE_FUNCTIONS[role].administration, ...ROLE_FUNCTIONS[role].user].map((f) => f.label),
  );
  return PENDING_COUNT_LABELS.filter((label) => navLabels.has(label));
}

// "Adoptions": a Payment submitted by an Adopter, awaiting Staff verification.
export function countPendingVerification(payments: AdoptionPayment[]): number {
  return payments.filter((p) => p.paymentStatus === "Pending").length;
}

// "Adoption Applications": matches the Decision section's own gate
// (adoption-application-detail-screen.tsx's canDecide) - "Under Review"
// is the one status a decision is actually pending in, and all 3
// SuitabilityChecks must be complete before that decision can be made.
export function countAwaitingDecision(applications: AdoptionApplication[], checks: SuitabilityCheck[]): number {
  return applications.filter((a) => {
    if (a.applicationStatus !== "Under Review") return false;
    const forApplication = checks.filter((c) => c.applicationId === a.applicationId);
    return forApplication.length === CHECK_TYPES.length && forApplication.every((c) => c.outcome !== "Pending");
  }).length;
}

// "Animal Intake": a Submitted Council Transfer with no linked Intake
// Record yet.
export function countUnlinkedSubmittedTransfers(
  transfers: CouncilTransferSubmission[],
  linkedTransferIds: Set<string>,
): number {
  return transfers.filter((t) => t.status === "Submitted" && !linkedTransferIds.has(t.id)).length;
}

// "Pre-Release Checks": an Animal Awaiting Release whose most recent
// Pre-Release Check is not Fit for Release (no check at all, or the latest
// came back Health Concern) - a Veterinarian still has a check to do.
export function countAwaitingPreReleaseCheck(animals: Animal[], checks: PreReleaseCheck[]): number {
  return animals.filter((animal) => {
    if (animal.currentStatus !== "Awaiting Release") return false;
    const latest = checks
      .filter((c) => c.animalId === animal.animalId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return latest?.fitnessResult !== "Fit for Release";
  }).length;
}

// "My Meet and Greets": a slot the Adopter still needs to pick
// (Proposed), or a scheduled visit they haven't yet confirmed attendance
// for (Scheduled, attendanceConfirmed false) - the two action states
// meet-and-greet-detail-screen.tsx renders a button for.
export function countPendingForAdopter(meetAndGreets: MeetAndGreet[], email: string): number {
  const normalized = email.trim().toLowerCase();
  return meetAndGreets.filter(
    (m) =>
      m.adopterEmail.toLowerCase() === normalized &&
      (m.status === "Proposed" || (m.status === "Scheduled" && !m.attendanceConfirmed)),
  ).length;
}
