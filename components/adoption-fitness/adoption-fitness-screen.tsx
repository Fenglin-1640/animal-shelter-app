"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import {
  confirmAsStaff,
  confirmAsVet,
  getFitnessReview,
  listTasksForAnimal,
  markTaskContinuable,
  taskActorRoles,
} from "@/lib/adoption-fitness/store";
import { TASK_STATUS_CATEGORY } from "@/lib/adoption-fitness/status";
import {
  getFitnessBlockers,
  isFitnessReviewComplete,
  TASK_TYPES,
  type AssessmentTask,
  type FitnessReview,
} from "@/lib/adoption-fitness/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Animal not found.</p>
      <Link
        href="/animals"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Animals
      </Link>
    </div>
  );
}

function AdoptionFitnessContent({
  animalId,
  email,
  displayName,
  role,
}: {
  animalId: string;
  email: string;
  displayName: string;
  role: Role;
}) {
  const [animal] = useState(() => getAnimalById(animalId));
  const [tasks, setTasks] = useState<AssessmentTask[]>(() =>
    animal ? listTasksForAnimal(animalId) : [],
  );
  const [review, setReview] = useState<FitnessReview | undefined>(() =>
    getFitnessReview(animalId),
  );

  if (!animal) return <NotFound />;

  const complete = isFitnessReviewComplete(review);
  const blockers = getFitnessBlockers(animal, tasks);

  const handleMarkContinuable = (taskId: string) => {
    const result = markTaskContinuable(taskId, email, displayName);
    if (result.ok) setTasks(listTasksForAnimal(animalId));
  };

  const handleConfirmStaff = () => {
    const result = confirmAsStaff(animalId, email, displayName);
    if (result.ok) setReview(getFitnessReview(animalId));
  };

  const handleConfirmVet = () => {
    const result = confirmAsVet(animalId, email, displayName);
    if (result.ok) setReview(getFitnessReview(animalId));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/animals/${animalId}`}
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to {animal.name}&apos;s Profile
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">Review Adoption Fitness</h1>
          <StatusChip
            label={complete ? "Confirmed" : "In Progress"}
            category={complete ? "success" : "progress"}
          />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Microchip Check is completed via Scan Microchip (FR-MC-01). Health Assessment
          (FR-MED-01) and Temperament Assessment (FR-BEH-01) are not built yet in this
          prototype - marking either Continuable here is a simplified stand-in that only tracks
          whether that track is ready for Review Adoption Fitness, per BR-016.
        </p>
      </div>

      {blockers.length > 0 && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-[12px] border border-gold bg-gold/10 px-3 py-3 text-sm text-text"
        >
          <p className="font-semibold">Blocking items:</p>
          <ul className="list-inside list-disc">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Parallel Assessment Tasks</h2>
        <div className="mt-4 flex flex-col gap-3">
          {TASK_TYPES.map((taskType) => {
            const task = tasks.find((t) => t.taskType === taskType);
            const status = task?.status ?? "Pending";
            const actorRoles = taskActorRoles(taskType);
            const canAct = actorRoles.includes(role);

            return (
              <div
                key={taskType}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-page px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-text">{taskType}</p>
                  {status === "Continuable" && task?.markedAt ? (
                    <p className="text-xs text-text-muted">
                      Marked continuable by {task.markedByName} on {formatDateTime(task.markedAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted">
                      Awaiting {actorRoles.filter((r) => r !== "Administrator").join(" or ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip label={status} category={TASK_STATUS_CATEGORY[status]} />
                  {status === "Pending" && taskType === "Microchip Check" ? (
                    canAct && !complete ? (
                      <Link
                        href={`/animals/${animalId}/scan-microchip`}
                        className="inline-flex h-9 items-center rounded-[12px] border border-border bg-surface px-3 text-sm font-semibold text-text hover:bg-surface-active"
                      >
                        Scan Microchip
                      </Link>
                    ) : (
                      <span
                        title={
                          complete
                            ? "This Fitness Review has already been confirmed."
                            : `Only ${actorRoles.join(" or ")} can complete this task.`
                        }
                        className="inline-flex h-9 cursor-not-allowed items-center rounded-[12px] border border-border bg-surface px-3 text-sm font-semibold text-text opacity-60"
                      >
                        Scan Microchip
                      </span>
                    )
                  ) : (
                    status === "Pending" && (
                      <button
                        type="button"
                        onClick={() => task && handleMarkContinuable(task.id)}
                        disabled={!canAct || complete}
                        title={
                          complete
                            ? "This Fitness Review has already been confirmed."
                            : !canAct
                              ? `Only ${actorRoles.join(" or ")} can complete this task.`
                              : undefined
                        }
                        className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Mark Continuable
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Joint Confirmation</h2>
        <p className="mt-1 text-sm text-text-muted">
          Review Adoption Fitness requires confirmation from both a Shelter Staff Member and a
          Veterinarian.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-page px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text">Shelter Staff Member</p>
              {review?.staffConfirmedAt ? (
                <p className="text-xs text-text-muted">
                  Confirmed by {review.staffConfirmedByName} on{" "}
                  {formatDateTime(review.staffConfirmedAt)}
                </p>
              ) : (
                <p className="text-xs text-text-muted">Not yet confirmed.</p>
              )}
            </div>
            {!review?.staffConfirmedAt && (
              <button
                type="button"
                onClick={handleConfirmStaff}
                disabled={!["Administrator", "Shelter Staff Member"].includes(role) || blockers.length > 0}
                title={
                  blockers.length > 0
                    ? "Resolve the blocking items above before confirming."
                    : !["Administrator", "Shelter Staff Member"].includes(role)
                      ? "Only Shelter Staff Member or Administrator can give this confirmation."
                      : undefined
                }
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm as Shelter Staff Member
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-page px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text">Veterinarian</p>
              {review?.vetConfirmedAt ? (
                <p className="text-xs text-text-muted">
                  Confirmed by {review.vetConfirmedByName} on{" "}
                  {formatDateTime(review.vetConfirmedAt)}
                </p>
              ) : (
                <p className="text-xs text-text-muted">Not yet confirmed.</p>
              )}
            </div>
            {!review?.vetConfirmedAt && (
              <button
                type="button"
                onClick={handleConfirmVet}
                disabled={!["Administrator", "Veterinarian"].includes(role) || blockers.length > 0}
                title={
                  blockers.length > 0
                    ? "Resolve the blocking items above before confirming."
                    : !["Administrator", "Veterinarian"].includes(role)
                      ? "Only Veterinarian or Administrator can give this confirmation."
                      : undefined
                }
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm as Veterinarian
              </button>
            )}
          </div>
        </div>

        {complete && (
          <p className="mt-4 text-sm text-text">
            Adoption fitness has been jointly confirmed. This does not by itself change the
            animal&apos;s status - Medical Clearance (FR-MED-03) and Publish Adoption Profile
            (FR-LIST-01) are separate later steps.
          </p>
        )}
      </section>
    </div>
  );
}

export function AdoptionFitnessScreen() {
  const { user } = useAuth();
  const params = useParams<{ animalId: string }>();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AdoptionFitnessContent
        animalId={params.animalId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
