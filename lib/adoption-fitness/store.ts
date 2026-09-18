import { getAnimalById } from "@/lib/animals/animal-store";
import { writeAuditLog } from "@/lib/audit/store";
import {
  getFitnessBlockers,
  TASK_TYPES,
  type AssessmentTask,
  type FitnessReview,
  type TaskType,
} from "@/lib/adoption-fitness/types";
import type { Role } from "@/lib/roles/roles";

// FR-INT-04: parallel assessment tasks and the joint Fitness Review
// confirmation, persisted to localStorage since there is no backend.
const TASKS_KEY = "asams-assessment-tasks";
const REVIEWS_KEY = "asams-fitness-reviews";

function loadAllTasks(): AssessmentTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssessmentTask[]) : [];
  } catch {
    return [];
  }
}

function saveAllTasks(tasks: AssessmentTask[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function loadAllReviews(): FitnessReview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REVIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FitnessReview[]) : [];
  } catch {
    return [];
  }
}

function saveAllReviews(reviews: FitnessReview[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

function generateTaskId(): string {
  return `AT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Called as a side effect of Finalise Intake (FR-INT-03). A no-op if
// tasks already exist for this animal.
export function createTasksForAnimal(animalId: string) {
  const all = loadAllTasks();
  if (all.some((t) => t.animalId === animalId)) return;
  const created: AssessmentTask[] = TASK_TYPES.map((taskType) => ({
    id: generateTaskId(),
    animalId,
    taskType,
    status: "Pending",
  }));
  saveAllTasks([...all, ...created]);
}

// The 10 PRD 12.1 seed animals predate this workflow and have no tasks
// of their own - lazily create them on first view so every animal
// reaching Under Assessment has the 3 tasks BR-016 describes.
export function listTasksForAnimal(animalId: string): AssessmentTask[] {
  createTasksForAnimal(animalId);
  return loadAllTasks().filter((t) => t.animalId === animalId);
}

export type MutationResult = { ok: true } | { ok: false; reason: "not_found" | "blocked" };

export function markTaskContinuable(
  taskId: string,
  email: string,
  name: string,
): MutationResult {
  const all = loadAllTasks();
  const index = all.findIndex((t) => t.id === taskId);
  if (index === -1) return { ok: false, reason: "not_found" };

  all[index] = {
    ...all[index],
    status: "Continuable",
    markedByEmail: email,
    markedByName: name,
    markedAt: new Date().toISOString(),
  };
  saveAllTasks(all);
  return { ok: true };
}

// Used by a task's real, dedicated feature (e.g. Scan Microchip, FR-MC-01)
// once it reaches a definitive outcome, superseding the generic "Mark
// Continuable" stand-in for that specific task type.
export function completeTaskByType(
  animalId: string,
  taskType: TaskType,
  email: string,
  name: string,
): MutationResult {
  const tasks = listTasksForAnimal(animalId);
  const task = tasks.find((t) => t.taskType === taskType);
  if (!task) return { ok: false, reason: "not_found" };
  return markTaskContinuable(task.id, email, name);
}

export function getFitnessReview(animalId: string): FitnessReview | undefined {
  return loadAllReviews().find((r) => r.animalId === animalId);
}

function upsertReview(review: FitnessReview) {
  const all = loadAllReviews();
  const index = all.findIndex((r) => r.animalId === review.animalId);
  if (index === -1) {
    saveAllReviews([...all, review]);
  } else {
    all[index] = review;
    saveAllReviews(all);
  }
}

async function confirm(
  animalId: string,
  email: string,
  name: string,
  side: "staff" | "vet",
): Promise<MutationResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const tasks = listTasksForAnimal(animalId);
  if (getFitnessBlockers(animal, tasks).length > 0) return { ok: false, reason: "blocked" };

  const existing = getFitnessReview(animalId) ?? { animalId };
  const now = new Date().toISOString();
  const updated: FitnessReview =
    side === "staff"
      ? { ...existing, staffConfirmedByEmail: email, staffConfirmedByName: name, staffConfirmedAt: now }
      : { ...existing, vetConfirmedByEmail: email, vetConfirmedByName: name, vetConfirmedAt: now };

  upsertReview(updated);

  await writeAuditLog({
    userId: email,
    userName: name,
    action: side === "staff" ? "Review Adoption Fitness - Staff Confirmation" : "Review Adoption Fitness - Veterinarian Confirmation",
    entityType: "Animal",
    entityId: animalId,
    oldValue: "",
    newValue: `Confirmed by ${name}`,
    result: "Success",
  });

  return { ok: true };
}

export function confirmAsStaff(animalId: string, email: string, name: string): Promise<MutationResult> {
  return confirm(animalId, email, name, "staff");
}

export function confirmAsVet(animalId: string, email: string, name: string): Promise<MutationResult> {
  return confirm(animalId, email, name, "vet");
}

// PRD 9 permission matrix: MedicalRecord (Health Assessment) is
// Veterinarian-only, not Administrator - see the note on
// components/medical/medical-screen.tsx's CAN_ACT_ROLES for why
// Administrator does not inherit this one.
export function taskActorRoles(taskType: TaskType): Role[] {
  return taskType === "Health Assessment"
    ? ["Veterinarian"]
    : ["Administrator", "Shelter Staff Member"];
}
