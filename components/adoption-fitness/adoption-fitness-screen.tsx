"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";
import { publishAdoptionProfile } from "@/lib/adoption-listings/publish";
import { getJson } from "@/lib/shared/http";
import type { Animal } from "@/lib/animals/types";
import { confirmAsStaff, getFitnessReview, listTasksForAnimal, taskActorRoles } from "@/lib/adoption-fitness/store";
import { TASK_STATUS_CATEGORY } from "@/lib/adoption-fitness/status";
import {
  getFitnessBlockers,
  isFitnessReviewComplete,
  TASK_TYPES,
  type AssessmentTask,
  type FitnessReview,
  type TaskType,
} from "@/lib/adoption-fitness/types";
import type { Role } from "@/lib/roles/roles";

// Review Adoption Fitness and Publish on one page (Shelter Staff and
// Administrator). The Veterinarian half of the review is confirmed
// automatically by the Medical Clearance, so it is shown here read-only.
const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];

// Each task has its own feature that completes it - this screen links to it.
const TASK_ROUTES: Record<TaskType, string> = {
  "Microchip Check": "scan-microchip",
  "Health Assessment": "medical",
  "Temperament Assessment": "behaviour",
};

const TASK_LABELS: Record<TaskType, string> = {
  "Microchip Check": "Scan Microchip",
  "Health Assessment": "Open Medical Record",
  "Temperament Assessment": "Open Behaviour Record",
};

// The blockers come with the animal's process journey (the same request
// the tracker makes), computed on the server from the records it loads.
async function loadBlockers(animalId: string): Promise<{ preListing: string[]; publish: string[] }> {
  const result = await getJson<{ preListingBlockers?: string[]; publishBlockers?: string[] }>(
    `/api/process/animals/${encodeURIComponent(animalId)}`,
  );
  return { preListing: result.preListingBlockers ?? [], publish: result.publishBlockers ?? [] };
}

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

// Reminder shown when Staff try to leave while the animal is ready to
// publish. Escape or "Stay on this page" keeps them here.
function PublishReminder({
  animalName,
  publishing,
  onPublish,
  onLeave,
  onStay,
}: {
  animalName: string;
  publishing: boolean;
  onPublish: () => void;
  onLeave: () => void;
  onStay: () => void;
}) {
  const publishRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    publishRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStay]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="publish-reminder-title" className="w-full max-w-[440px] rounded-[12px] border border-border bg-surface p-6 shadow-lg">
        <h2 id="publish-reminder-title" className="text-lg font-bold text-text">
          {animalName} is ready to publish
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Publish now so adopters can find this listing. If you leave without publishing, it stays in
          Needs my action until it is published.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            ref={publishRef}
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:opacity-60"
          >
            {publishing ? "Publishing..." : "Publish now"}
          </button>
          <button type="button" onClick={onLeave} className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active">
            Leave without publishing
          </button>
          <button type="button" onClick={onStay} className="h-9 rounded-[12px] px-3 text-sm font-semibold text-secondary underline underline-offset-2">
            Stay on this page
          </button>
        </div>
      </div>
    </div>
  );
}

function AdoptionFitnessContent({ animalId, email, displayName, role }: { animalId: string; email: string; displayName: string; role: Role }) {
  const router = useRouter();
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [tasks, setTasks] = useState<AssessmentTask[]>([]);
  const [review, setReview] = useState<FitnessReview | undefined>(undefined);
  // Null until the blockers arrive.
  const [publishBlockers, setPublishBlockers] = useState<string[] | null>(null);
  const [preListingBlockers, setPreListingBlockers] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const reload = async () => {
    const [animalResult, taskResult, reviewResult, blockerResult] = await Promise.all([
      getAnimalById(animalId),
      listTasksForAnimal(animalId),
      getFitnessReview(animalId),
      loadBlockers(animalId),
    ]);
    setAnimal(animalResult ?? null);
    setTasks(taskResult);
    setReview(reviewResult);
    setPreListingBlockers(blockerResult.preListing);
    setPublishBlockers(blockerResult.publish);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAnimalById(animalId), listTasksForAnimal(animalId), getFitnessReview(animalId)]).then(
      ([animalResult, taskResult, reviewResult]) => {
        if (cancelled) return;
        setAnimal(animalResult ?? null);
        setTasks(taskResult);
        setReview(reviewResult);
        // The Publish section fills in after the main content, so this
        // heavier request does not compete with it.
        return loadBlockers(animalId).then((b) => {
          if (cancelled) return;
          setPreListingBlockers(b.preListing);
          setPublishBlockers(b.publish);
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  const readyToPublish = animal?.listingStatus === "Pre-Listing" && publishBlockers?.length === 0 && !published;

  // While the animal is ready to publish, catch in-app navigation away
  // (links anywhere on the page, including the sidebar) and show the
  // reminder; the browser's own prompt covers closing or reloading the tab.
  useEffect(() => {
    if (!readyToPublish) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [readyToPublish]);

  if (animal === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!animal) return <NotFound />;

  const complete = isFitnessReviewComplete(review);
  const blockers = getFitnessBlockers(animal, tasks);
  const isListed = animal.listingStatus === "Current" || animal.listingStatus === "Adopted";

  // A completed review is one of the Pre-Listing conditions, so re-check
  // eligibility after confirming; Publish then appears right here.
  const handleConfirmStaff = async () => {
    const result = await confirmAsStaff(animalId, email, displayName);
    if (!result.ok) return;
    await evaluatePreListingEligibility(animalId, { email, name: displayName });
    await reload();
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishAdoptionProfile(animalId, email, displayName);
      if (result.ok) {
        setPublished(true);
        await reload();
      } else {
        await reload();
      }
      return result.ok;
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/animals/${animalId}`} className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline">
          &larr; Back to {animal.name}&apos;s Profile
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">Review Adoption Fitness and Publish</h1>
          <StatusChip label={isListed ? "Published" : complete ? "Confirmed" : "In Progress"} category={isListed || complete ? "success" : "progress"} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Complete each task from its own screen: Scan Microchip, Medical Record (Health Assessment) and Behaviour
          Record (Temperament Assessment).
        </p>
      </div>

      {blockers.length > 0 && (
        <div role="status" className="flex flex-col gap-1 rounded-[12px] border border-gold bg-gold/10 px-3 py-3 text-sm text-text">
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
              <div key={taskType} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-page px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-text">{taskType}</p>
                  {status === "Continuable" && task?.markedAt ? (
                    <p className="text-xs text-text-muted">
                      Marked continuable by {task.markedByName} on {formatDateTime(task.markedAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted">Awaiting {actorRoles.filter((r) => r !== "Administrator").join(" or ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip label={status} category={TASK_STATUS_CATEGORY[status]} />
                  {status === "Pending" &&
                    (canAct && !complete ? (
                      <Link
                        href={`/animals/${animalId}/${TASK_ROUTES[taskType]}`}
                        className="inline-flex h-9 items-center rounded-[12px] border border-border bg-surface px-3 text-sm font-semibold text-text hover:bg-surface-active"
                      >
                        {TASK_LABELS[taskType]}
                      </Link>
                    ) : (
                      <span
                        title={complete ? "This Fitness Review has already been confirmed." : `Only ${actorRoles.join(" or ")} can complete this task.`}
                        className="inline-flex h-9 cursor-not-allowed items-center rounded-[12px] border border-border bg-surface px-3 text-sm font-semibold text-text opacity-60"
                      >
                        {TASK_LABELS[taskType]}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Joint Confirmation</h2>
        <p className="mt-1 text-sm text-text-muted">
          Adoption fitness is confirmed by Shelter Staff here and by a Veterinarian when they issue the Medical
          Clearance.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-page px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text">Shelter Staff</p>
              {review?.staffConfirmedAt ? (
                <p className="text-xs text-text-muted">
                  Confirmed by {review.staffConfirmedByName} on {formatDateTime(review.staffConfirmedAt)}
                </p>
              ) : (
                <p className="text-xs text-text-muted">Not yet confirmed.</p>
              )}
            </div>
            {!review?.staffConfirmedAt && (
              <button
                type="button"
                onClick={handleConfirmStaff}
                disabled={blockers.length > 0}
                title={blockers.length > 0 ? "Resolve the blocking items above before confirming." : undefined}
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm as Shelter Staff
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-page px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text">Veterinarian</p>
              {review?.vetConfirmedAt ? (
                <p className="text-xs text-text-muted">
                  Confirmed with Medical Clearance by {review.vetConfirmedByName} on {formatDateTime(review.vetConfirmedAt)}
                </p>
              ) : (
                <p className="text-xs text-text-muted">Waiting on Veterinarian: Medical Clearance</p>
              )}
            </div>
            <StatusChip label={review?.vetConfirmedAt ? "Confirmed with Medical Clearance" : "Waiting"} category={review?.vetConfirmedAt ? "success" : "progress"} />
          </div>
        </div>
      </section>

      <section aria-labelledby="publish-heading" className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 id="publish-heading" className="text-lg font-bold text-text">
          Publish Adoption Profile
        </h2>
        {isListed ? (
          <p role="status" className="mt-2 text-sm text-text">
            {animal.name} is published on Adoption Listings.
          </p>
        ) : animal.listingStatus === "Pre-Listing" ? (
          <>
            {publishBlockers === null ? (
              <p className="mt-2 text-sm text-text-muted">Checking publishing requirements...</p>
            ) : publishBlockers.length > 0 ? (
              <div className="mt-2 flex flex-col gap-1 rounded-[12px] border border-gold bg-gold/10 px-3 py-3 text-sm text-text">
                <p className="font-semibold">Before publishing:</p>
                <ul className="list-inside list-disc">
                  {publishBlockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-sm text-text">{animal.name} is Pre-Listing and ready to publish.</p>
            )}
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={!publishBlockers || publishBlockers.length > 0 || publishing}
              className="mt-4 h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? "Publishing..." : "Publish now"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-text-muted">Publishing becomes available once {animal.name} moves to Pre-Listing.</p>
            {preListingBlockers.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-text-muted">
                {preListingBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {pendingHref && readyToPublish && (
        <PublishReminder
          animalName={animal.name}
          publishing={publishing}
          onPublish={async () => {
            const href = pendingHref;
            if (await handlePublish()) {
              setPendingHref(null);
              router.push(href);
            }
          }}
          onLeave={() => {
            const href = pendingHref;
            setPendingHref(null);
            setPublished(true); // stop intercepting for this navigation
            router.push(href);
          }}
          onStay={() => setPendingHref(null)}
        />
      )}
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
      <AdoptionFitnessContent animalId={params.animalId} email={user.email} displayName={user.displayName} role={user.role} />
    </AppShell>
  );
}
