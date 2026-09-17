import { changeAnimalStatus, getAnimalById } from "@/lib/animals/animal-store";
import { getAdopterProfile } from "@/lib/adopter-profile/store";
import { getAdopterProfileSubmissionBlockers } from "@/lib/adopter-profile/types";
import { writeAuditLog } from "@/lib/audit/store";
import type { AdoptionApplication, ApplicationDocument } from "@/lib/applications/types";

// FR-APP-01: AdoptionApplication records, persisted to localStorage
// since there is no backend.
const STORAGE_KEY = "asams-adoption-applications";

function loadAll(): AdoptionApplication[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdoptionApplication[]) : [];
  } catch {
    return [];
  }
}

function saveAll(all: AdoptionApplication[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function generateApplicationId(): string {
  return `APP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function listMyApplications(email: string): AdoptionApplication[] {
  const normalized = email.trim().toLowerCase();
  return loadAll()
    .filter((a) => a.adopterEmail.toLowerCase() === normalized)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listApplicationsForAnimal(animalId: string): AdoptionApplication[] {
  return loadAll()
    .filter((a) => a.animalId === animalId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listAllApplications(): AdoptionApplication[] {
  return loadAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getApplication(applicationId: string): AdoptionApplication | undefined {
  return loadAll().find((a) => a.applicationId === applicationId);
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

  const existingDraft = loadAll().find(
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
  saveAll([...loadAll(), application]);
  return { ok: true, applicationId: application.applicationId };
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

export function updateDraft(
  applicationId: string,
  input: { motivationStatement: string; documents: ApplicationDocument[] },
): MutationResult {
  const all = loadAll();
  const index = all.findIndex((a) => a.applicationId === applicationId);
  if (index === -1) return { ok: false, reason: "not_found" };
  if (all[index].applicationStatus !== "Draft") return { ok: false, reason: "not_draft" };

  all[index] = { ...all[index], ...input, updatedAt: new Date().toISOString() };
  saveAll(all);
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

export function submitApplication(applicationId: string): SubmitResult {
  const all = loadAll();
  const index = all.findIndex((a) => a.applicationId === applicationId);
  if (index === -1) return { ok: false, reason: "not_found" };
  const application = all[index];
  if (application.applicationStatus !== "Draft") return { ok: false, reason: "not_draft" };

  const blockers: string[] = [];
  if (!application.motivationStatement.trim()) {
    blockers.push("A motivation statement is required.");
  }
  const profile = getAdopterProfile(application.adopterEmail);
  blockers.push(...getAdopterProfileSubmissionBlockers(profile));
  if (blockers.length > 0) return { ok: false, reason: "blocked", blockers };

  const now = new Date().toISOString();
  all[index] = {
    ...application,
    profileSnapshot: profile,
    applicationStatus: "Submitted",
    submissionDate: now,
    updatedAt: now,
  };
  saveAll(all);

  writeAuditLog({
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
export function markUnderReview(applicationId: string) {
  const all = loadAll();
  const index = all.findIndex((a) => a.applicationId === applicationId);
  if (index === -1) return;
  if (all[index].applicationStatus !== "Submitted") return;
  all[index] = { ...all[index], applicationStatus: "Under Review", updatedAt: new Date().toISOString() };
  saveAll(all);
}

function setStatus(applicationId: string, patch: Partial<AdoptionApplication>) {
  const all = loadAll();
  const index = all.findIndex((a) => a.applicationId === applicationId);
  if (index === -1) return;
  all[index] = { ...all[index], ...patch, updatedAt: new Date().toISOString() };
  saveAll(all);
}

// FR-CHK-02: Approve moves the Animal to Application In Progress and
// puts every other undecided application for the same Animal On Hold.
export async function approveApplication(
  applicationId: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const application = getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };

  const now = new Date().toISOString();
  setStatus(applicationId, {
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
  writeAuditLog({
    userId: email,
    userName: name,
    action: "Approve Adoption Application",
    entityType: "Animal",
    entityId: application.animalId,
    oldValue: `applicationId=${applicationId}`,
    newValue: "Approved",
    result: "Success",
  });

  for (const other of listApplicationsForAnimal(application.animalId)) {
    if (
      other.applicationId !== applicationId &&
      (other.applicationStatus === "Submitted" || other.applicationStatus === "Under Review")
    ) {
      setStatus(other.applicationId, { applicationStatus: "On Hold" });
    }
  }

  return { ok: true };
}

// FR-CHK-02: Reject requires a reason. The Animal was never moved off
// Available For Adoption by an application that gets rejected before
// ever being approved (the only path this prototype exercises), so
// currentStatus is left untouched - "Animal 保持...Available For Adoption".
export function rejectApplication(
  applicationId: string,
  reason: string,
  email: string,
  name: string,
): MutationResult {
  if (!reason.trim()) return { ok: false, reason: "reason_required" };
  const application = getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };

  setStatus(applicationId, {
    applicationStatus: "Rejected",
    decisionDate: new Date().toISOString(),
    decisionByEmail: email,
    decisionByName: name,
    rejectionReason: reason.trim(),
  });

  writeAuditLog({
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
  const application = getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };

  setStatus(applicationId, {
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
  const application = getApplication(applicationId);
  if (!application) return { ok: false, reason: "not_found" };
  if (application.applicationStatus !== "On Hold") return { ok: false, reason: "not_on_hold" };

  const animal = await getAnimalById(application.animalId);
  if (!animal || animal.currentStatus !== "Available For Adoption") {
    return { ok: false, reason: "animal_not_available" };
  }

  setStatus(applicationId, { applicationStatus: "Under Review" });
  return { ok: true };
}

export function markFinalised(applicationId: string) {
  setStatus(applicationId, { applicationStatus: "Finalised" });
}
