import { changeAnimalStatus, getAllAnimals, getAnimalById } from "@/lib/animals/animal-store";
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

// FR-NOT-01 "Behaviour reassessment due": the latest assessment per
// animal, wherever it called for a follow-up reassessment (set on the
// form whenever a Behaviour Program continues - see
// recordTemperamentAssessment below).
export async function listAssessmentsNeedingReassessment(): Promise<TemperamentAssessment[]> {
  const animals = await getAllAnimals();
  return animals
    .map((animal) => getLatestTemperamentAssessment(animal.animalId))
    .filter((a): a is TemperamentAssessment => !!a?.followUpRequired && !!a.reassessmentDate);
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
export async function recordTemperamentAssessment(
  animalId: string,
  input: TemperamentAssessmentInput,
  email: string,
  name: string,
): Promise<MutationResult> {
  const animal = await getAnimalById(animalId);
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

  // PRD 7.1's state table only allows Under Assessment -> In Behaviour
  // Program for a negative outcome - there is no direct Under Assessment
  // -> Unsuitable For Adoption edge. So on a FIRST-time assessment (no
  // active program), both negative outcomes (Requires Behaviour
  // Modification and Unsuitable for Public Adoption) start/continue a
  // Behaviour Program; "Permanently Unsuitable" only finalises to
  // Unsuitable For Adoption when chosen on a REASSESSMENT within an
  // active program, matching FR-BEH-02's prose sequence (Program ->
  // reassessment -> Suitable after Program | Permanently Unsuitable).
  if (input.outcome === "Suitable for Adoption") {
    if (activeProgram) {
      resolveProgram(activeProgram.id, "Completed - Suitable", now);
      await changeAnimalStatus(
        animalId,
        { currentStatus: "Under Assessment", statusUpdatedAt: now },
        { email, name },
        "Behaviour Program - Suitable After Program",
      );
    }
    completeTaskByType(animalId, "Temperament Assessment", email, name);
  } else if (activeProgram && input.outcome === "Unsuitable for Public Adoption") {
    resolveProgram(activeProgram.id, "Completed - Permanently Unsuitable", now);
    await changeAnimalStatus(
      animalId,
      {
        currentStatus: "Unsuitable For Adoption",
        listingStatus: "Removed",
        statusUpdatedAt: now,
      },
      { email, name },
      "Behaviour Program - Permanently Unsuitable",
    );
  } else {
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
    await changeAnimalStatus(
      animalId,
      { currentStatus: "In Behaviour Program", statusUpdatedAt: now },
      { email, name },
      `Temperament Assessment - ${input.outcome}`,
    );
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
export async function archiveUnsuitableAnimal(
  animalId: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };
  if (animal.currentStatus !== "Unsuitable For Adoption") {
    return { ok: false, reason: "invalid_state" };
  }
  await changeAnimalStatus(
    animalId,
    { currentStatus: "Archived", statusUpdatedAt: new Date().toISOString() },
    { email, name },
    "Archive Record",
  );
  return { ok: true };
}
