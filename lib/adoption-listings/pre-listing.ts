import { changeAnimalStatus, getAnimalById, type StatusActor } from "@/lib/animals/animal-store";
import { getLatestTemperamentAssessment } from "@/lib/behaviour/store";
import { getMedicalClearance } from "@/lib/medical/store";
import { hasUnresolvedHold } from "@/lib/statutory-hold/store";

// PRD 3.2 row 3 / FR-MED-03's closing paragraph: once Medical Clearance
// is issued, no unresolved Statutory Hold remains, and the latest
// Behavioural Assessment outcome is Suitable for Adoption, the system
// moves listingStatus to Pre-Listing - the only state Publish Adoption
// Profile (FR-LIST-01, lib/adoption-listings/publish.ts) accepts
// (BR-007). The "Publish Adoption Profile task" PRD mentions is the
// Pre-Listing state itself: Staff find these animals via the Animals list
// filter, and the Animal Profile shows the Publish action for them.
//
// There is no single mutation this must follow (any of the 3 conditions
// could be the last to complete, including a Statutory Hold resolving
// via lazy expiry), so this is called from the UI layer wherever one of
// those conditions might have just changed (Medical, Behaviour, Animal
// Profile), rather than from inside lib/medical, lib/behaviour or
// lib/statutory-hold themselves (which would create an import cycle
// back into this module). Safe to call repeatedly - a no-op once
// listingStatus is no longer Not Fit. The move goes through
// changeAnimalStatus() so it is validated against PRD 7.2 and written to
// the AuditLog; actor is the signed-in user whose action triggered it.
export async function evaluatePreListingEligibility(animalId: string, actor: StatusActor) {
  const animal = await getAnimalById(animalId);
  if (!animal || animal.listingStatus !== "Not Fit") return;

  if (!(await getMedicalClearance(animalId))) return;
  if (await hasUnresolvedHold(animalId)) return;
  if ((await getLatestTemperamentAssessment(animalId))?.outcome !== "Suitable for Adoption") return;

  await changeAnimalStatus(
    animalId,
    { listingStatus: "Pre-Listing", statusUpdatedAt: new Date().toISOString() },
    actor,
    "Move to Pre-Listing (Medical Clearance issued, no hold, Suitable for Adoption)",
  );
}
