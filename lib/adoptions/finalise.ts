import { changeAnimalStatus } from "@/lib/animals/animal-store";
import { getActiveAgreementForApplication } from "@/lib/agreements/store";
import { getApplication, markFinalised } from "@/lib/applications/store";
import { getMeetAndGreetForApplication } from "@/lib/meet-and-greets/store";
import { getLatestPaymentForAgreement } from "@/lib/payments/store";

// FR-FIN-01: orchestrates across applications/agreements/payments/meet-
// and-greets, none of which import each other (see closeApplicationIncompatible's
// comment in lib/meet-and-greets/store.ts) - this module sits above all
// four so none of them needs to import this one back.
export type FinaliseResult = { ok: true } | { ok: false; reason: string; blockers: string[] };

export async function getFinaliseBlockers(applicationId: string): Promise<string[]> {
  const blockers: string[] = [];
  const application = await getApplication(applicationId);
  if (!application) return ["Application not found."];

  const meetAndGreet = await getMeetAndGreetForApplication(applicationId);
  if (meetAndGreet?.status !== "Compatible") {
    blockers.push("Meet and Greet outcome must be Compatible.");
  }

  const agreement = await getActiveAgreementForApplication(applicationId);
  if (!agreement?.isSigned) {
    blockers.push("Adoption Agreement must be signed.");
  }

  const payment = agreement ? await getLatestPaymentForAgreement(agreement.agreementId) : undefined;
  if (payment?.paymentStatus !== "Cleared") {
    blockers.push("Adoption Payment must be Cleared.");
  }

  return blockers;
}

// PRD 6.13: "系统必须同时验证: Meet and Greet outcome = Compatible, AdoptionAgreement
// isSigned = true, AdoptionPayment paymentStatus = Cleared." Success:
// Application Finalised, listingStatus = Adopted (removed from public
// listing), currentStatus = Awaiting Release, adopterId written to
// Animal, a Pre-Release Check task created.
//
// Judgment call, disclosed in docs/BUILD-PROGRESS.md: this prototype's
// Animal model has no dedicated adopterId field - the existing generic
// linkedPerson (already used for Registered Owner in Statutory Hold) is
// reused with role "Adopter". "Creating a Pre-Release Check task" is
// realized structurally rather than as a separate task entity: an
// Animal with currentStatus = Awaiting Release and no completed
// Pre-Release Check on file IS the task - FR-REL-01's Veterinarian
// queue reads exactly that state.
export async function finaliseAdoption(applicationId: string, email: string, name: string): Promise<FinaliseResult> {
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found", blockers: [] };

  const blockers = await getFinaliseBlockers(applicationId);
  if (blockers.length > 0) return { ok: false, reason: "blocked", blockers };

  const result = await changeAnimalStatus(
    application.animalId,
    {
      currentStatus: "Awaiting Release",
      listingStatus: "Adopted",
      statusUpdatedAt: new Date().toISOString(),
      linkedPerson: { role: "Adopter", name: application.adopterName },
    },
    { email, name },
    "Finalise Adoption Record",
  );
  if (!result.ok) return { ok: false, reason: result.reason, blockers: [] };

  await markFinalised(applicationId);

  return { ok: true };
}
