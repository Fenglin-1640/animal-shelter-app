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

// FR-INT-04: AssessmentTask and the joint FitnessReview confirmation
// now live in the database (see prisma/contract.prisma) behind
// /api/assessment-tasks and /api/fitness-reviews - see
// prisma/README.md for this Prisma toolchain's quirks.

async function fetchAllTasks(): Promise<AssessmentTask[]> {
  const response = await fetch("/api/assessment-tasks");
  const result = await response.json();
  return result.items as AssessmentTask[];
}

async function fetchAllReviews(): Promise<FitnessReview[]> {
  const response = await fetch("/api/fitness-reviews");
  const result = await response.json();
  return result.items as FitnessReview[];
}

function generateTaskId(): string {
  return `AT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Called as a side effect of Finalise Intake (FR-INT-03). A no-op if
// tasks already exist for this animal.
export async function createTasksForAnimal(animalId: string): Promise<void> {
  const all = await fetchAllTasks();
  if (all.some((t) => t.animalId === animalId)) return;
  for (const taskType of TASK_TYPES) {
    const task: AssessmentTask = {
      id: generateTaskId(),
      animalId,
      taskType,
      status: "Pending",
    };
    await fetch("/api/assessment-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
  }
}

// The 10 PRD 12.1 seed animals predate this workflow and have no tasks
// of their own - lazily create them on first view so every animal
// reaching Under Assessment has the 3 tasks BR-016 describes.
export async function listTasksForAnimal(animalId: string): Promise<AssessmentTask[]> {
  await createTasksForAnimal(animalId);
  return (await fetchAllTasks()).filter((t) => t.animalId === animalId);
}

export type MutationResult = { ok: true } | { ok: false; reason: "not_found" | "blocked" };

export async function markTaskContinuable(
  taskId: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const response = await fetch(`/api/assessment-tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "Continuable",
      markedByEmail: email,
      markedByName: name,
      markedAt: new Date().toISOString(),
    }),
  });
  const result = await response.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };
  return { ok: true };
}

// Used by each task's dedicated feature (Scan Microchip, Health
// Assessment, Temperament Assessment) once it reaches a continuable
// outcome - the only way a task becomes Continuable.
export async function completeTaskByType(
  animalId: string,
  taskType: TaskType,
  email: string,
  name: string,
): Promise<MutationResult> {
  const tasks = await listTasksForAnimal(animalId);
  const task = tasks.find((t) => t.taskType === taskType);
  if (!task) return { ok: false, reason: "not_found" };
  return markTaskContinuable(task.id, email, name);
}

export async function getFitnessReview(animalId: string): Promise<FitnessReview | undefined> {
  return (await fetchAllReviews()).find((r) => r.animalId === animalId);
}

async function upsertReview(review: FitnessReview): Promise<void> {
  await fetch("/api/fitness-reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
}

async function confirm(
  animalId: string,
  email: string,
  name: string,
  side: "staff" | "vet",
): Promise<MutationResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const tasks = await listTasksForAnimal(animalId);
  if (getFitnessBlockers(animal, tasks).length > 0) return { ok: false, reason: "blocked" };

  const existing = (await getFitnessReview(animalId)) ?? { animalId };
  const now = new Date().toISOString();
  const updated: FitnessReview =
    side === "staff"
      ? { ...existing, staffConfirmedByEmail: email, staffConfirmedByName: name, staffConfirmedAt: now }
      : { ...existing, vetConfirmedByEmail: email, vetConfirmedByName: name, vetConfirmedAt: now };

  await upsertReview(updated);

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
