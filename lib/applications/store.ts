import { changeAnimalStatus, getAnimalById } from "@/lib/animals/animal-store";
import { getAdopterProfile } from "@/lib/adopter-profile/store";
import { getAdopterProfileSubmissionBlockers } from "@/lib/adopter-profile/types";
import { writeAuditLog } from "@/lib/audit/store";
import { allChecksComplete } from "@/lib/checks/store";
import type { AdoptionApplication, ApplicationDocument } from "@/lib/applications/types";

// FR-APP-01: AdoptionApplication now lives in the database (see
// prisma/contract.prisma) behind /api/applications - see
// prisma/README.md for this Prisma toolchain's quirks.

async function fetchAll(): Promise<AdoptionApplication[]> {
  const response = await fetch("/api/applications");
  const result = await response.json();
  return result.items as AdoptionApplication[];
}

async function patchApplication(applicationId: string, patch: Partial<AdoptionApplication>): Promise<void> {
  await fetch(`/api/applications/${applicationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

function generateApplicationId(): string {
  return `APP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function listMyApplications(email: string): Promise<AdoptionApplication[]> {
  const normalized = email.trim().toLowerCase();
  const all = await fetchAll();
  return all
    .filter((a) => a.adopterEmail.toLowerCase() === normalized)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function listApplicationsForAnimal(animalId: string): Promise<AdoptionApplication[]> {
  const all = await fetchAll();
  return all
    .filter((a) => a.animalId === animalId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function listAllApplications(): Promise<AdoptionApplication[]> {
  const all = await fetchAll();
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

// For the "Adoption Applications" nav badge
// (lib/pending-actions/registry.ts) - matches the Decision section's own
// allow-list gate (adoption-application-detail-screen.tsx's canDecide):
// "Under Review" is the one status a decision is actually pending in,
// and all 3 SuitabilityChecks must be complete before that decision can
// be made.
export async function countAwaitingDecision(): Promise<number> {
  const underReview = (await fetchAll()).filter((a) => a.applicationStatus === "Under Review");
  const completeFlags = await Promise.all(underReview.map((a) => allChecksComplete(a.applicationId)));
  return completeFlags.filter(Boolean).length;
}

export async function getApplication(applicationId: string): Promise<AdoptionApplication | undefined> {
  const all = await fetchAll();
  return all.find((a) => a.applicationId === applicationId);
}

// BR-008 / FR-APP-01: only an eligible, currently-listed, accepting
// Animal may receive a new Draft. Re-uses an existing own Draft for the
// same animal rather than creating duplicates if the Adopter navigates
// to "Apply Now" again before submitting.
export type StartApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; reason: "animal_not_found" | "not_eligible" };

export async function startOrContinueDraft(
  animalId: string,
  email: string,
  name: string,
): Promise<StartApplicationResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "animal_not_found" };
  if (animal.currentStatus !== "Available For Adoption" || animal.listingStatus !== "Current") {
    return { ok: false, reason: "not_eligible" };
  }

  const existingDraft = (await fetchAll()).find(
    (a) =>
      a.animalId === animalId &&
      a.adopterEmail.toLowerCase() === email.trim().toLowerCase() &&
      a.applicationStatus === "Draft",
  );
  if (existingDraft) return { ok: true, applicationId: existingDraft.applicationId };

  const now = new Date().toISOString();
  const application: AdoptionApplication = {
    applicationId: generateApplicationId(),
    adopterEmail: email,
    adopterName: name,
    animalId,
    animalName: animal.name,
    animalSpecies: animal.species,
    animalBreed: animal.breed,
    motivationStatement: "",
    documents: [],
    applicationStatus: "Draft",
    createdAt: now,
    updatedAt: now,
  };
  await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(application),
  });
  return { ok: true, applicationId: application.applicationId };
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

export async function updateDraft(
  applicationId: string,
  input: { motivationStatement: string; documents: ApplicationDocument[] },
): Promise<MutationResult> {
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };
  if (application.applicationStatus !== "Draft") return { ok: false, reason: "not_draft" };

  await patchApplication(applicationId, { ...input, updatedAt: new Date().toISOString() });
  return { ok: true };
}

// FR-APP-01: validates the underlying Adopter Profile is complete
// (BR-covered fields), snapshots it, and submits. FR-CHK-01's 3
// SuitabilityChecks are created by the caller (components/applications)
// right after a successful submit, via lib/checks/store.ts -
// lib/applications and lib/checks intentionally don't import each other.
export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_draft" | "blocked"; blockers?: string[] };

export async function submitApplication(applicationId: string): Promise<SubmitResult> {
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };
  if (application.applicationStatus !== "Draft") return { ok: false, reason: "not_draft" };

  const blockers: string[] = [];
  if (!application.motivationStatement.trim()) {
    blockers.push("A motivation statement is required.");
  }
  const profile = await getAdopterProfile(application.adopterEmail);
  blockers.push(...getAdopterProfileSubmissionBlockers(profile));
  if (blockers.length > 0) return { ok: false, reason: "blocked", blockers };

  const now = new Date().toISOString();
  await patchApplication(applicationId, {
    profileSnapshot: profile,
    applicationStatus: "Submitted",
    submissionDate: now,
    updatedAt: now,
  });

  await writeAuditLog({
    userId: application.adopterEmail,
    userName: application.adopterName,
    action: "Submit Adoption Application",
    entityType: "Animal",
    entityId: application.animalId,
    oldValue: "",
    newValue: `applicationId=${applicationId}`,
    result: "Success",
  });

  return { ok: true };
}

// Called once a check moves off Pending (components/checks), so
// applicationStatus reflects that review has begun - avoids a circular
// import between lib/applications and lib/checks.
export async function markUnderReview(applicationId: string): Promise<void> {
  const application = await getApplication(applicationId);
  if (!application || application.applicationStatus !== "Submitted") return;
  await patchApplication(applicationId, { applicationStatus: "Under Review", updatedAt: new Date().toISOString() });
}

async function setStatus(applicationId: string, patch: Partial<AdoptionApplication>): Promise<void> {
  await patchApplication(applicationId, { ...patch, updatedAt: new Date().toISOString() });
}

// FR-CHK-02: Approve moves the Animal to Application In Progress and
// puts every other undecided application for the same Animal On Hold.
export async function approveApplication(
  applicationId: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };
  if (application.applicationStatus !== "Under Review") return { ok: false, reason: "not_under_review" };

  const now = new Date().toISOString();
  await setStatus(applicationId, {
    applicationStatus: "Approved",
    decisionDate: now,
    decisionByEmail: email,
    decisionByName: name,
  });

  await changeAnimalStatus(
    application.animalId,
    { currentStatus: "Application In Progress", statusUpdatedAt: now },
    { email, name },
    "Approve Adoption Application",
  );

  // changeAnimalStatus() already wrote an Animal-status audit entry, but
  // it has no reason to mention applicationId - add a dedicated entry so
  // this decision is searchable/traceable by applicationId too, the same
  // as rejectApplication() below.
  await writeAuditLog({
    userId: email,
    userName: name,
    action: "Approve Adoption Application",
    entityType: "Animal",
    entityId: application.animalId,
    oldValue: `applicationId=${applicationId}`,
    newValue: "Approved",
    result: "Success",
  });

  for (const other of await listApplicationsForAnimal(application.animalId)) {
    if (
      other.applicationId !== applicationId &&
      (other.applicationStatus === "Submitted" || other.applicationStatus === "Under Review")
    ) {
      await setStatus(other.applicationId, { applicationStatus: "On Hold" });
    }
  }

  return { ok: true };
}

// FR-CHK-02: Reject requires a reason. The Animal was never moved off
// Available For Adoption by an application that gets rejected before
// ever being approved (the only path this prototype exercises), so
// currentStatus is left untouched - "Animal 保持...Available For Adoption".
export async function rejectApplication(
  applicationId: string,
  reason: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  if (!reason.trim()) return { ok: false, reason: "reason_required" };
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };
  if (application.applicationStatus !== "Under Review") return { ok: false, reason: "not_under_review" };

  await setStatus(applicationId, {
    applicationStatus: "Rejected",
    decisionDate: new Date().toISOString(),
    decisionByEmail: email,
    decisionByName: name,
    rejectionReason: reason.trim(),
  });

  await writeAuditLog({
    userId: email,
    userName: name,
    action: "Reject Adoption Application",
    entityType: "Animal",
    entityId: application.animalId,
    oldValue: `applicationId=${applicationId}`,
    newValue: `Rejected: ${reason.trim()}`,
    result: "Success",
  });

  return { ok: true };
}

// FR-MG-01: "Incompatible 关闭申请，写明原因，执行 Return Animal to Available Pool，并
//将 currentStatus 恢复为 Available For Adoption" - a distinct closure path
// from FR-CHK-02's Reject (which never moves the Animal, since it only
// ever runs before any Approve). This one reuses the "Rejected"
// ApplicationStatus value (no separate "Closed" status is seeded) since
// the Adopter-facing outcome is the same shape - an ended application
// with a stated reason - but does move the Animal, because by this point
// it had already been moved to Application In Progress by Approve.
export async function closeApplicationIncompatible(
  applicationId: string,
  reason: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };

  await setStatus(applicationId, {
    applicationStatus: "Rejected",
    decisionDate: new Date().toISOString(),
    decisionByEmail: email,
    decisionByName: name,
    rejectionReason: reason.trim(),
  });

  await changeAnimalStatus(
    application.animalId,
    { currentStatus: "Available For Adoption", statusUpdatedAt: new Date().toISOString() },
    { email, name },
    "Meet and Greet Incompatible - Return Animal to Available Pool",
  );

  return { ok: true };
}

// PRD: "若当前申请失败，可恢复处理" - once the Animal is Available For Adoption
// again (e.g. after a Meet and Greet Incompatible outcome returns it),
// an On-Hold application for it can resume being processed.
export async function resumeApplication(applicationId: string): Promise<MutationResult> {
  const application = await getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };
  if (application.applicationStatus !== "On Hold") return { ok: false, reason: "not_on_hold" };

  const animal = await getAnimalById(application.animalId);
  if (!animal || animal.currentStatus !== "Available For Adoption") {
    return { ok: false, reason: "animal_not_available" };
  }

  await setStatus(applicationId, { applicationStatus: "Under Review" });
  return { ok: true };
}

export async function markFinalised(applicationId: string): Promise<void> {
  await setStatus(applicationId, { applicationStatus: "Finalised" });
}
