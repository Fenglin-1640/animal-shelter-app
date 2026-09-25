import { changeAnimalStatus, getAnimalById } from "@/lib/animals/animal-store";
import { getLatestTemperamentAssessment } from "@/lib/behaviour/store";
import { getMedicalClearance } from "@/lib/medical/store";
import { getPrimaryPhoto } from "@/lib/photos/store";
import { hasUnresolvedHold } from "@/lib/statutory-hold/store";

// FR-LIST-01's 5 conditions, plus BR-007's "Staff publish from
// Pre-Listing": the animal must already be in Pre-Listing, which only
// evaluatePreListingEligibility() (lib/adoption-listings/pre-listing.ts)
// sets, once Medical Clearance is issued, no Statutory Hold is
// unresolved and the latest Behavioural Assessment is Suitable. The
// first 3 conditions are re-checked here via the same getters as a
// safety net in case something changed after the animal reached
// Pre-Listing (e.g. a new hold or a later assessment).
export async function getPublishBlockers(animalId: string): Promise<string[]> {
  const animal = await getAnimalById(animalId);
  if (!animal) return ["Animal not found."];

  const blockers: string[] = [];
  if (animal.listingStatus !== "Pre-Listing") {
    blockers.push(
      `Listing status must be Pre-Listing to publish (currently ${animal.listingStatus}, ${animal.currentStatus}).`,
    );
  }
  if (!(await getMedicalClearance(animalId))) blockers.push("Medical Clearance has not been issued.");
  if ((await getLatestTemperamentAssessment(animalId))?.outcome !== "Suitable for Adoption") {
    blockers.push("The latest Behavioural Assessment is not Suitable for Adoption.");
  }
  if (await hasUnresolvedHold(animalId)) blockers.push("There is an unresolved Statutory Hold on this animal.");
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
  // Checks the alt text itself, not just that a public photo exists: an
  // intake photo becomes the default public photo even when no alt text
  // was entered at Intake (it's optional there).
  if (!(await getPrimaryPhoto(animalId))?.altText.trim()) {
    blockers.push("A public photo with alt text must be selected.");
  }

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
