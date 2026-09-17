import { changeAnimalStatus, getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { listApplicationsForAnimal } from "@/lib/applications/store";
import { writeAuditLog } from "@/lib/audit/store";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { isFitForRelease } from "@/lib/medical/store";
import type { FollowUpType, FollowUpVisit, WelfareOutcome } from "@/lib/follow-up-visits/types";

// FR-REL-02: FollowUpVisit records, persisted to localStorage since
// there is no backend.
const STORAGE_KEY = "asams-follow-up-visits";

function loadAll(): FollowUpVisit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FollowUpVisit[]) : [];
  } catch {
    return [];
  }
}

function saveAll(all: FollowUpVisit[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function generateId(): string {
  return `FUV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function listFollowUpVisitsForAnimal(animalId: string): FollowUpVisit[] {
  return loadAll()
    .filter((v) => v.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// The state machine (Awaiting Release -> inFollowUpPeriod -> Rehomed, a
// named final state) means an Animal can only ever go through this once,
// so there is at most one FollowUpVisit per animal - but read the latest
// defensively rather than assuming exactly one.
export function getLatestFollowUpVisitForAnimal(animalId: string): FollowUpVisit | undefined {
  return listFollowUpVisitsForAnimal(animalId)[0];
}

export function getFollowUpVisit(followUpVisitId: string): FollowUpVisit | undefined {
  return loadAll().find((v) => v.followUpVisitId === followUpVisitId);
}

export function listActiveFollowUpVisits(): FollowUpVisit[] {
  return loadAll()
    .filter((v) => v.status === "Scheduled")
    .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
}

export function listMyFollowUpVisits(email: string): FollowUpVisit[] {
  const normalized = email.trim().toLowerCase();
  return loadAll()
    .filter((v) => v.adopterEmail.toLowerCase() === normalized)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// The 10 PRD 12.1 seed animals predate the real AdoptionApplication
// workflow - Daisy (A-0008) is seeded directly into Awaiting Release
// with only an Animal.linkedPerson name, no backing Finalised
// Application. Matching that name against the seeded demo Adopter
// account (PRD 12.1's Daisy scenario deliberately names the same
// "Jordan Taylor" as U-DEMO-ADOPTER) lets this seed scenario be
// exercised for real - the same precedent as
// lib/adoption-fitness/store.ts's lazy AssessmentTask backfill for
// animals that predate that workflow too.
function resolveAdopterForAnimal(
  animal: Animal,
): { applicationId: string; adopterEmail: string; adopterName: string } | undefined {
  const finalised = listApplicationsForAnimal(animal.animalId).find((a) => a.applicationStatus === "Finalised");
  if (finalised) {
    return { applicationId: finalised.applicationId, adopterEmail: finalised.adopterEmail, adopterName: finalised.adopterName };
  }

  if (animal.linkedPerson?.role === "Adopter") {
    const demoAdopter = DEMO_ACCOUNTS.find(
      (a) => a.role === "Adopter" && `${a.firstName} ${a.lastName}` === animal.linkedPerson?.name,
    );
    if (demoAdopter) {
      return { applicationId: `SEED-${animal.animalId}`, adopterEmail: demoAdopter.email, adopterName: animal.linkedPerson.name };
    }
  }

  return undefined;
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

export interface ReleaseInput {
  careInstructionsProvided: boolean;
  releaseDate: string;
  receivingAdopter: string;
  targetDate: string;
  followUpType: FollowUpType;
}

// PRD 6.14 FR-REL-02: "放行时 Staff 确认 care instructions 已提供，并记录 releaseDate
// 和 receivingAdopter。随后 currentStatus = inFollowUpPeriod，创建 FollowUpVisit".
// Gated to Shelter Staff Member only at the call site (PRD 9's Pre-Release
// Check row: Administrator 只读, only Staff "执行 release") - this function
// itself only enforces the state-machine and data preconditions, matching
// changeAnimalStatus()'s "role checks live at the call site" convention.
export async function releaseAnimal(
  animalId: string,
  input: ReleaseInput,
  actorEmail: string,
  actorName: string,
): Promise<MutationResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };
  if (animal.currentStatus !== "Awaiting Release") return { ok: false, reason: "not_awaiting_release" };
  if (!(await isFitForRelease(animalId))) return { ok: false, reason: "not_fit_for_release" };
  if (!input.careInstructionsProvided) return { ok: false, reason: "care_instructions_required" };
  if (!input.receivingAdopter.trim()) return { ok: false, reason: "receiving_adopter_required" };

  const adopter = resolveAdopterForAnimal(animal);
  if (!adopter) return { ok: false, reason: "no_finalised_application" };

  const now = new Date().toISOString();
  const visit: FollowUpVisit = {
    followUpVisitId: generateId(),
    animalId,
    animalName: animal.name,
    applicationId: adopter.applicationId,
    adopterEmail: adopter.adopterEmail,
    adopterName: adopter.adopterName,
    careInstructionsProvided: input.careInstructionsProvided,
    releaseDate: input.releaseDate,
    receivingAdopter: input.receivingAdopter.trim(),
    releasedByEmail: actorEmail,
    releasedByName: actorName,
    targetDate: input.targetDate,
    followUpType: input.followUpType,
    assignedStaffEmail: actorEmail,
    assignedStaffName: actorName,
    status: "Scheduled",
    outcomeNotes: "",
    createdAt: now,
  };
  saveAll([...loadAll(), visit]);

  const result = await changeAnimalStatus(
    animalId,
    { currentStatus: "inFollowUpPeriod", statusUpdatedAt: now },
    { email: actorEmail, name: actorName },
    "Release Animal to Adopter",
  );
  if (!result.ok) return { ok: false, reason: result.reason };

  writeAuditLog({
    userId: actorEmail,
    userName: actorName,
    action: "Release Animal to Adopter",
    entityType: "FollowUpVisit",
    entityId: visit.followUpVisitId,
    oldValue: "",
    newValue: `releaseDate=${input.releaseDate}, receivingAdopter=${visit.receivingAdopter}, targetDate=${input.targetDate}, followUpType=${input.followUpType}`,
    result: "Success",
  });

  return { ok: true };
}

// PRD: "Staff 完成回访并记录 welfare outcome 后，currentStatus = Rehomed."
// Available to both Administrator and Shelter Staff Member per PRD 9's
// FollowUpVisit row ("安排、完成" for both), unlike the Release action
// itself which the Pre-Release Check row restricts to Staff only.
export async function completeFollowUpVisit(
  followUpVisitId: string,
  outcome: WelfareOutcome,
  outcomeNotes: string,
  actorEmail: string,
  actorName: string,
): Promise<MutationResult> {
  const all = loadAll();
  const index = all.findIndex((v) => v.followUpVisitId === followUpVisitId);
  if (index === -1) return { ok: false, reason: "not_found" };
  const visit = all[index];
  if (visit.status !== "Scheduled") return { ok: false, reason: "already_completed" };

  const now = new Date().toISOString();
  all[index] = {
    ...visit,
    status: "Completed",
    outcome,
    outcomeNotes,
    completedByEmail: actorEmail,
    completedByName: actorName,
    completedAt: now,
  };
  saveAll(all);

  const result = await changeAnimalStatus(
    visit.animalId,
    { currentStatus: "Rehomed", statusUpdatedAt: now },
    { email: actorEmail, name: actorName },
    "Complete Follow Up Visit",
  );
  if (!result.ok) return { ok: false, reason: result.reason };

  writeAuditLog({
    userId: actorEmail,
    userName: actorName,
    action: "Complete Follow Up Visit",
    entityType: "FollowUpVisit",
    entityId: followUpVisitId,
    oldValue: "status=Scheduled",
    newValue: `status=Completed, outcome=${outcome}`,
    result: "Success",
  });

  return { ok: true };
}
