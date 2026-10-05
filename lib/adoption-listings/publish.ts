import { changeAnimalStatus, getAnimalById } from "@/lib/animals/animal-store";
import { getLatestTemperamentAssessment } from "@/lib/behaviour/store";
import { getMedicalClearance } from "@/lib/medical/store";
import { getPrimaryPhoto } from "@/lib/photos/store";
import { getFitnessReview } from "@/lib/adoption-fitness/store";
import { hasUnresolvedHold } from "@/lib/statutory-hold/store";

// FR-LIST-01's 5 conditions, plus BR-007's "Staff publish from
// Pre-Listing": the animal must already be in Pre-Listing, which only
// evaluatePreListingEligibility() (lib/adoption-listings/pre-listing.ts)
// sets, once getPreListingBlockers() is empty (Medical Clearance issued,
// no unresolved Statutory Hold, latest Behavioural Assessment Suitable,
// Review Adoption Fitness confirmed). The clearance, hold, behaviour and
// fitness review conditions are re-checked here via the same getters as a
// safety net in case something changed after the animal reached
// Pre-Listing (e.g. a new hold, which also withdraws the Vet fitness
// confirmation, or a later assessment). Photo alt text is optional.
export async function getPublishBlockers(animalId: string): Promise<string[]> {
  // The lookups are independent, so fetch them together; the blocker
  // order below is unchanged.
  const [animal, clearance, latestAssessment, unresolvedHold, primaryPhoto, review] = await Promise.all([
    getAnimalById(animalId),
    getMedicalClearance(animalId),
    getLatestTemperamentAssessment(animalId),
    hasUnresolvedHold(animalId),
    getPrimaryPhoto(animalId),
    getFitnessReview(animalId),
  ]);
  if (!animal) return ["Animal not found."];

  const blockers: string[] = [];
  if (animal.listingStatus !== "Pre-Listing") {
    blockers.push(
      `Listing status must be Pre-Listing to publish (currently ${animal.listingStatus}, ${animal.currentStatus}).`,
    );
  }
  if (!clearance) blockers.push("Medical Clearance has not been issued.");
  if (latestAssessment?.outcome !== "Suitable for Adoption") {
    blockers.push("The latest Behavioural Assessment is not Suitable for Adoption.");
  }
  if (unresolvedHold) blockers.push("There is an unresolved Statutory Hold on this animal.");
  // Re-checked because the Vet half can now be withdrawn after Pre-Listing
  // (a new Statutory Hold), until the clearance is issued again.
  if (!review?.staffConfirmedAt || !review?.vetConfirmedAt) {
    blockers.push("Review Adoption Fitness has not been confirmed by both Shelter Staff and Veterinarian.");
  }
  if (animal.adoptionFee == null) blockers.push("Adoption Fee must be filled in.");
  if (!animal.generalDescription.trim()) blockers.push("General Description must be filled in.");
  if (!animal.breed.trim() || animal.breed === "Unknown") {
    // "Unknown" is the placeholder older Finalise Intake runs wrote before
    // Breed was captured at intake - not a real Staff answer, so it doesn't
    // satisfy FR-LIST-01's "breed is filled in".
    blockers.push("Breed must be filled in.");
  }
  if (!animal.sex) blockers.push("Sex must be filled in.");
  if (animal.temperaments.length === 0) blockers.push("At least one Temperament must be filled in.");
  // A public photo must be selected; its alt text is optional.
  if (!primaryPhoto) blockers.push("A public photo must be selected.");

  return blockers;
}

export type PublishResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "blocked"; blockers?: string[] };

export async function publishAdoptionProfile(animalId: string, email: string, name: string): Promise<PublishResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const blockers = await getPublishBlockers(animalId);
  if (blockers.length > 0) return { ok: false, reason: "blocked", blockers };

  await changeAnimalStatus(
    animalId,
    { currentStatus: "Available For Adoption", listingStatus: "Current", statusUpdatedAt: new Date().toISOString() },
    { email, name },
    "Publish Adoption Profile",
  );
  return { ok: true };
}

export type UnpublishResult = { ok: true } | { ok: false; reason: "not_found" | "invalid_state" };

// PRD 9's "Adoption Listing | 发布、撤下、查看" row and PRD 7.2's Removed
// definition ("...或 Staff 合规移除") - withdrawing a listing is a
// display-level compliance action, not a lifecycle event, so only
// listingStatus changes; currentStatus is left as-is.
export async function unpublishAdoptionProfile(animalId: string, email: string, name: string): Promise<UnpublishResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };
  if (animal.listingStatus !== "Current") return { ok: false, reason: "invalid_state" };

  await changeAnimalStatus(
    animalId,
    { listingStatus: "Removed", statusUpdatedAt: new Date().toISOString() },
    { email, name },
    "Withdraw Listing",
  );
  return { ok: true };
}
