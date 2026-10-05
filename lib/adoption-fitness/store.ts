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
import { getJson, send } from "@/lib/shared/http";

// FR-INT-04: AssessmentTask and the joint FitnessReview confirmation
// now live in the database (see prisma/contract.prisma) behind
// /api/assessment-tasks and /api/fitness-reviews - see
// prisma/README.md for this Prisma toolchain's quirks.

async function fetchTasks(animalId: string): Promise<AssessmentTask[]> {
  const result = await getJson(`/api/assessment-tasks?animalId=${encodeURIComponent(animalId)}`);
  return result.items as AssessmentTask[];
}

async function fetchAllReviews(): Promise<FitnessReview[]> {
  const result = await getJson("/api/fitness-reviews");
  return result.items as FitnessReview[];
}

function generateTaskId(): string {
  return `AT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Called as a side effect of Finalise Intake (FR-INT-03). A no-op if
// tasks already exist for this animal.
export async function createTasksForAnimal(animalId: string): Promise<void> {
  if ((await fetchTasks(animalId)).length > 0) return;
  for (const taskType of TASK_TYPES) {
    const task: AssessmentTask = {
      id: generateTaskId(),
      animalId,
      taskType,
      status: "Pending",
    };
    await send("/api/assessment-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
  }
}

// The 10 PRD 12.1 seed animals predate this workflow and have no tasks
// of their own - lazily create them on first view so every animal
// reaching Under Assessment has the 3 tasks BR-016 describes.
// One request when the tasks already exist.
export async function listTasksForAnimal(animalId: string): Promise<AssessmentTask[]> {
  const existing = await fetchTasks(animalId);
  if (existing.length > 0) return existing;
  await createTasksForAnimal(animalId);
  return fetchTasks(animalId);
}

export type MutationResult = { ok: true } | { ok: false; reason: "not_found" | "blocked" };

export async function markTaskContinuable(
  taskId: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const response = await send(`/api/assessment-tasks/${taskId}`, {
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
  await send("/api/fitness-reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
}

// Shelter Staff half only. The Veterinarian half is confirmed on the
// server when a Veterinarian issues the Medical Clearance
// (app/api/medical/clearances/route.ts).
export async function confirmAsStaff(animalId: string, email: string, name: string): Promise<MutationResult> {
  const animal = await getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  const tasks = await listTasksForAnimal(animalId);
  if (getFitnessBlockers(animal, tasks).length > 0) return { ok: false, reason: "blocked" };

  const existing = (await getFitnessReview(animalId)) ?? { animalId };
  const now = new Date().toISOString();
  const updated: FitnessReview = { ...existing, staffConfirmedByEmail: email, staffConfirmedByName: name, staffConfirmedAt: now };

  await upsertReview(updated);

  await writeAuditLog({
    userId: email,
    userName: name,
    action: "Review Adoption Fitness - Staff Confirmation",
    entityType: "Animal",
    entityId: animalId,
    oldValue: "",
    newValue: `Confirmed by ${name}`,
    result: "Success",
  });

  return { ok: true };
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
