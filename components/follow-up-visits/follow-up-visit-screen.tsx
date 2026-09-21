"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { ReadOnlyNoticeModal } from "@/components/shared/read-only-notice-modal";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { completeFollowUpVisit, getLatestFollowUpVisitForAnimal } from "@/lib/follow-up-visits/store";
import { FOLLOW_UP_VISIT_STATUS_CATEGORY, WELFARE_OUTCOME_CATEGORY } from "@/lib/follow-up-visits/status";
import type { FollowUpVisit, WelfareOutcome } from "@/lib/follow-up-visits/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
// PRD 9: FollowUpVisit is 安排、完成 for Administrator and Shelter Staff
// Member equally, 只读 for Veterinarian.
const CAN_ACT_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];

const WELFARE_OUTCOMES: WelfareOutcome[] = ["Settling Well", "Concerns Noted", "Unable to Contact Adopter"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">No Follow-Up Visit found for this animal.</p>
      <Link
        href="/animals"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Animals
      </Link>
    </div>
  );
}

function CompleteVisitForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (outcome: WelfareOutcome, notes: string) => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState<WelfareOutcome>("Settling Well");
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="fuv-outcome" className="text-xs font-semibold text-text-muted">Welfare Outcome</label>
        <select
          id="fuv-outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as WelfareOutcome)}
          className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {WELFARE_OUTCOMES.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="fuv-notes" className="text-xs font-semibold text-text-muted">Notes</label>
        <textarea
          id="fuv-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      <p className="text-xs text-text-muted">
        Submitting will mark this animal Rehomed - the final step of its lifecycle.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSubmit(outcome, notes)}
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
        >
          Complete Follow-Up Visit
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FollowUpVisitContent({ animalId, email, displayName, role }: { animalId: string; email: string; displayName: string; role: Role }) {
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [visit, setVisit] = useState<FollowUpVisit | undefined>(undefined);
  const [visitLoaded, setVisitLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const canAct = CAN_ACT_ROLES.includes(role);

  useEffect(() => {
    let cancelled = false;
    getAnimalById(animalId).then((result) => {
      if (!cancelled) setAnimal(result ?? null);
    });
    getLatestFollowUpVisitForAnimal(animalId).then((result) => {
      if (cancelled) return;
      setVisit(result);
      setVisitLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  if (animal === undefined || !visitLoaded) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!animal || !visit) return <NotFound />;

  const refresh = async () => {
    setAnimal((await getAnimalById(animalId)) ?? null);
    setVisit(await getLatestFollowUpVisitForAnimal(animalId));
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
          <h1 className="text-2xl font-bold text-text">Follow-Up Visit</h1>
          <StatusChip label={visit.status} category={FOLLOW_UP_VISIT_STATUS_CATEGORY[visit.status]} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId} &middot; {animal.currentStatus}
        </p>
      </div>

      {!canAct && (
        <ReadOnlyNoticeModal
          storageKey={`follow-up-visit:${role}`}
          title="Read-only access"
          message={
            role === "Veterinarian"
              ? "Veterinarian has read-only visibility of Follow-Up Visits."
              : "You do not have permission to complete this Follow-Up Visit."
          }
        />
      )}

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Release Details</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-text-muted">Release Date</dt>
            <dd className="text-text">{formatDate(visit.releaseDate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-text-muted">Receiving Adopter</dt>
            <dd className="text-text">{visit.receivingAdopter}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-text-muted">Care Instructions Provided</dt>
            <dd className="text-text">{visit.careInstructionsProvided ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-text-muted">Released By</dt>
            <dd className="text-text">{visit.releasedByName}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Follow-Up Visit</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-text-muted">Target Date</dt>
            <dd className="text-text">{formatDate(visit.targetDate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-text-muted">Type</dt>
            <dd className="text-text">{visit.followUpType}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-text-muted">Assigned Staff</dt>
            <dd className="text-text">{visit.assignedStaffName}</dd>
          </div>
        </dl>

        {visit.status === "Completed" && visit.outcome && (
          <div className="mt-4 rounded-[12px] border border-border bg-page p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-text">Welfare Outcome</span>
              <StatusChip label={visit.outcome} category={WELFARE_OUTCOME_CATEGORY[visit.outcome]} />
            </div>
            {visit.outcomeNotes && <p className="mt-1 text-text">{visit.outcomeNotes}</p>}
            <p className="mt-1 text-xs text-text-muted">
              {visit.completedByName} &middot; {visit.completedAt && formatDateTime(visit.completedAt)}
            </p>
          </div>
        )}

        {canAct && visit.status === "Scheduled" && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Complete Follow-Up Visit
          </button>
        )}
        {canAct && visit.status === "Scheduled" && showForm && (
          <CompleteVisitForm
            onCancel={() => setShowForm(false)}
            onSubmit={async (outcome, notes) => {
              await completeFollowUpVisit(visit.followUpVisitId, outcome, notes, email, displayName);
              setShowForm(false);
              refresh();
            }}
          />
        )}
      </section>
    </div>
  );
}

export function FollowUpVisitScreen() {
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
      <FollowUpVisitContent
        animalId={params.animalId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
