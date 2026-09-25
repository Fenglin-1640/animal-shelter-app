import { getFitnessReview } from "@/lib/adoption-fitness/store";
import { changeAnimalStatus, getAnimalById, type StatusActor } from "@/lib/animals/animal-store";
import { getLatestTemperamentAssessment } from "@/lib/behaviour/store";
import { getMedicalClearance } from "@/lib/medical/store";
import { hasUnresolvedHold } from "@/lib/statutory-hold/store";

// The conditions for moving listingStatus to Pre-Listing - the only
// state Publish Adoption Profile (FR-LIST-01, lib/adoption-listings/
// publish.ts) accepts (BR-007). The first 3 are PRD 3.2 row 3 /
// FR-MED-03's closing paragraph: Medical Clearance issued, no unresolved
// Statutory Hold, latest Behavioural Assessment Suitable for Adoption.
// The 4th is Review Adoption Fitness (FR-INT-04 / BR-016): both the
// Shelter Staff Member and Veterinarian confirmations recorded. Without
// it an animal could be listed without its Microchip Check ever being
// run and without the joint sign-off on the 3 parallel intake tasks -
// Medical Clearance itself only covers vaccination and desexing.
// Listed as unmet-condition messages (like getPublishBlockers) so the
// Animal Profile can show Staff what's still missing.
export async function getPreListingBlockers(animalId: string): Promise<string[]> {
  const blockers: string[] = [];
  if (!(await getMedicalClearance(animalId))) blockers.push("Medical Clearance has not been issued.");
  if (await hasUnresolvedHold(animalId)) blockers.push("There is an unresolved Statutory Hold on this animal.");
  if ((await getLatestTemperamentAssessment(animalId))?.outcome !== "Suitable for Adoption") {
    blockers.push("The latest Behavioural Assessment is not Suitable for Adoption.");
  }
  const review = await getFitnessReview(animalId);
  if (!review?.staffConfirmedAt || !review?.vetConfirmedAt) {
    const missing = [
      !review?.staffConfirmedAt && "Shelter Staff Member",
      !review?.vetConfirmedAt && "Veterinarian",
    ].filter(Boolean);
    blockers.push(`Review Adoption Fitness has not been confirmed (missing: ${missing.join(" and ")}).`);
  }
  return blockers;
}

// Moves a Not Fit animal to Pre-Listing once getPreListingBlockers() is
// empty. The "Publish Adoption Profile task" PRD mentions is the
// Pre-Listing state itself: Staff find these animals via the Animals list
// filter, and the Animal Profile shows the Publish action for them.
//
// There is no single mutation this must follow (any of the 4 conditions
// could be the last to complete, including a Statutory Hold resolving
// via lazy expiry), so this is called from the UI layer wherever one of
// those conditions might have just changed (Medical, Behaviour, Review
// Adoption Fitness, Animal Profile), rather than from inside
// lib/medical, lib/behaviour, lib/adoption-fitness or
// lib/statutory-hold themselves (which would create an import cycle
// back into this module). Safe to call repeatedly - a no-op once
// listingStatus is no longer Not Fit. The move goes through
// changeAnimalStatus() so it is validated against PRD 7.2 and written to
// the AuditLog; actor is the signed-in user whose action triggered it.
export async function evaluatePreListingEligibility(animalId: string, actor: StatusActor) {
  const animal = await getAnimalById(animalId);
  if (!animal || animal.listingStatus !== "Not Fit") return;
  if ((await getPreListingBlockers(animalId)).length > 0) return;

  await changeAnimalStatus(
    animalId,
    { listingStatus: "Pre-Listing", statusUpdatedAt: new Date().toISOString() },
    actor,
    "Move to Pre-Listing (Medical Clearance issued, no hold, Suitable for Adoption, Adoption Fitness confirmed)",
  );
}
