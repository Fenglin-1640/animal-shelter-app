import { getAnimalById, updateAnimal } from "@/lib/animals/animal-store";
import { completeTaskByType } from "@/lib/adoption-fitness/store";
import type {
  BehaviourProgram,
  TemperamentAssessment,
} from "@/lib/behaviour/types";

// FR-BEH-01/02: persisted to localStorage since there is no backend.
const ASSESSMENT_KEY = "asams-temperament-assessments";
const PROGRAM_KEY = "asams-behaviour-programs";

function loadList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function listTemperamentAssessments(animalId: string): TemperamentAssessment[] {
  return loadList<TemperamentAssessment>(ASSESSMENT_KEY)
    .filter((a) => a.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLatestTemperamentAssessment(animalId: string): TemperamentAssessment | undefined {
  return listTemperamentAssessments(animalId)[0];
}

export function listBehaviourPrograms(animalId: string): BehaviourProgram[] {
  return loadList<BehaviourProgram>(PROGRAM_KEY)
    .filter((p) => p.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getActiveBehaviourProgram(animalId: string): BehaviourProgram | undefined {
  return listBehaviourPrograms(animalId).find((p) => p.status === "Active");
}

export interface TemperamentAssessmentInput {
  handlingResponse: string;
  reactionToStrangers: string;
  foodBehaviour: string;
  interactionWithOtherAnimals: string;
  socialisationScore: number;
  observations: string;
  recommendations: string;
  assessmentDate: string;
  followUpRequired: boolean;
  reassessmentDate?: string;
  outcome: TemperamentAssessment["outcome"];
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

// FR-BEH-01 recording + FR-BEH-02's system effects, unified: the same 3
// -value outcome enum drives the same transitions whether this is a
// first-time assessment or a post-program reassessment (PRD's "Suitable
// after Program" / "Permanently Unsuitable" read as this enum's values
// chosen in a reassessment context, not a separate 4th/5th outcome).
export function recordTemperamentAssessment(
  animalId: string,
  input: TemperamentAssessmentInput,
  email: string,
  name: string,
): MutationResult {
  const animal = getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const activeProgram = getActiveBehaviourProgram(animalId);
  const now = new Date().toISOString();
  const assessment: TemperamentAssessment = {
    id: generateId("BA"),
    animalId,
    ...input,
    assessorEmail: email,
    assessorName: name,
    createdAt: now,
    programReassessmentOf: activeProgram?.id,
  };
  saveList(ASSESSMENT_KEY, [...loadList<TemperamentAssessment>(ASSESSMENT_KEY), assessment]);

  if (input.outcome === "Requires Behaviour Modification") {
    if (!activeProgram) {
      const program: BehaviourProgram = {
        id: generateId("BP"),
        animalId,
        triggeringAssessmentId: assessment.id,
        status: "Active",
        createdAt: now,
      };
      saveList(PROGRAM_KEY, [...loadList<BehaviourProgram>(PROGRAM_KEY), program]);
    }
    updateAnimal(animalId, { currentStatus: "In Behaviour Program", statusUpdatedAt: now });
  } else if (input.outcome === "Suitable for Adoption") {
    if (activeProgram) {
      resolveProgram(activeProgram.id, "Completed - Suitable", now);
      updateAnimal(animalId, { currentStatus: "Under Assessment", statusUpdatedAt: now });
    }
    completeTaskByType(animalId, "Temperament Assessment", email, name);
  } else {
    if (activeProgram) resolveProgram(activeProgram.id, "Completed - Permanently Unsuitable", now);
    updateAnimal(animalId, {
      currentStatus: "Unsuitable For Adoption",
      listingStatus: "Removed",
      statusUpdatedAt: now,
    });
  }

  return { ok: true };
}

function resolveProgram(
  programId: string,
  status: BehaviourProgram["status"],
  resolvedAt: string,
) {
  const all = loadList<BehaviourProgram>(PROGRAM_KEY);
  const index = all.findIndex((p) => p.id === programId);
  if (index === -1) return;
  all[index] = { ...all[index], status, resolvedAt };
  saveList(PROGRAM_KEY, all);
}

// PRD 7.1: "Unsuitable For Adoption | permanently unsuitable | Staff |
// Archived" - a separate Staff-confirmed step, not automatic, so the
// animal remains inspectable in the Unsuitable For Adoption state first
// (matches the PRD 12.1 Rocky seed scenario, "Archive 路径").
export function archiveUnsuitableAnimal(animalId: string): MutationResult {
  const animal = getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };
  if (animal.currentStatus !== "Unsuitable For Adoption") {
    return { ok: false, reason: "invalid_state" };
  }
  updateAnimal(animalId, { currentStatus: "Archived", statusUpdatedAt: new Date().toISOString() });
  return { ok: true };
}
