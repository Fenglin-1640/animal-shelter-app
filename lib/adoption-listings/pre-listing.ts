import { getAnimalById, updateAnimal } from "@/lib/animals/animal-store";
import { getLatestTemperamentAssessment } from "@/lib/behaviour/store";
import { getMedicalClearance } from "@/lib/medical/store";
import { hasUnresolvedHold } from "@/lib/statutory-hold/store";

// PRD 3.2 row 3 / FR-MED-03's closing paragraph: once Medical Clearance
// is issued, no unresolved Statutory Hold remains, and the latest
// Behavioural Assessment outcome is Suitable for Adoption, the system
// moves listingStatus to Pre-Listing. PRD also says this "creates a
// Staff 的 Publish Adoption Profile 任务" - no separate task-list
// infrastructure exists for that (Publish Adoption Profile is FR-LIST-01,
// not built), so the observable signal is listingStatus itself: Staff
// can find Pre-Listing animals via the Animals list filter.
//
// There is no single mutation this must follow (any of the 3 conditions
// could be the last to complete, including a Statutory Hold resolving
// via lazy expiry), so this is called from the UI layer wherever one of
// those conditions might have just changed, rather than from inside
// lib/medical, lib/behaviour or lib/statutory-hold themselves (which
// would create an import cycle back into this module). Safe to call
// repeatedly - a no-op once listingStatus is no longer Not Fit.
export async function evaluatePreListingEligibility(animalId: string) {
  const animal = await getAnimalById(animalId);
  if (!animal || animal.listingStatus !== "Not Fit") return;

  if (!(await getMedicalClearance(animalId))) return;
  if (await hasUnresolvedHold(animalId)) return;
  if ((await getLatestTemperamentAssessment(animalId))?.outcome !== "Suitable for Adoption") return;

  await updateAnimal(animalId, { listingStatus: "Pre-Listing" });
}
