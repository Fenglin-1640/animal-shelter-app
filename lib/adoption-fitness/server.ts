import { auditRow } from "@/lib/audit/server";
import type { db } from "@/lib/db/client";

// Server-side helpers for the Vet half of Review Adoption Fitness, which a
// Veterinarian's Medical Clearance now confirms automatically.

type Orm = typeof db.orm;

export const VET_CONFIRMATION_NOTE = "Confirmed together with Medical Clearance";

// Withdraws the automatic Vet confirmation (e.g. a new unresolved
// Statutory Hold) so an animal can't keep its Pre-Listing eligibility - or
// be published - on a stale confirmation. Audited; returns whether
// anything changed. Call inside the transaction making the triggering
// change.
export async function invalidateVetConfirmation(
  orm: Orm,
  animalId: string,
  actor: { email: string; name: string },
  reason: string,
): Promise<boolean> {
  const review = await orm.FitnessReview.where({ animalId }).first();
  if (!review?.vetConfirmedAt) return false;
  await orm.FitnessReview.where({ animalId }).update({
    vetConfirmedByEmail: null,
    vetConfirmedByName: null,
    vetConfirmedAt: null,
    vetConfirmationNote: `Withdrawn: ${reason}`,
  });
  await orm.AuditLogEntry.create(
    auditRow({
      actor,
      action: "Review Adoption Fitness - Veterinarian Confirmation Withdrawn",
      entityType: "Animal",
      entityId: animalId,
      oldValue: `Confirmed by ${review.vetConfirmedByName ?? "Veterinarian"}`,
      newValue: `Not confirmed (${reason})`,
    }),
  );
  return true;
}
