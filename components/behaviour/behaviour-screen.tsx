"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { evaluatePreListingEligibility } from "@/lib/adoption-listings/pre-listing";
import {
  listBehaviourPrograms,
  listTemperamentAssessments,
  recordTemperamentAssessment,
  type TemperamentAssessmentInput,
} from "@/lib/behaviour/store";
import { OUTCOME_CATEGORY, PROGRAM_STATUS_CATEGORY } from "@/lib/behaviour/status";
import {
  BEHAVIOUR_OUTCOMES,
  type BehaviourProgram,
  type TemperamentAssessment,
} from "@/lib/behaviour/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
const CAN_ACT_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];
const SOCIALISATION_SCORES = [1, 2, 3, 4, 5];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
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

function TemperamentAssessmentForm({
  isReassessment,
  onSubmit,
  onCancel,
}: {
  isReassessment: boolean;
  onSubmit: (input: TemperamentAssessmentInput) => void;
  onCancel: () => void;
}) {
  const [handlingResponse, setHandlingResponse] = useState("");
  const [reactionToStrangers, setReactionToStrangers] = useState("");
  const [foodBehaviour, setFoodBehaviour] = useState("");
  const [interactionWithOtherAnimals, setInteractionWithOtherAnimals] = useState("");
  const [socialisationScore, setSocialisationScore] = useState(3);
  const [observations, setObservations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayDate());
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [reassessmentDate, setReassessmentDate] = useState("");
  const [outcome, setOutcome] = useState<TemperamentAssessmentInput["outcome"] | "">("");

  const canSubmit =
    handlingResponse.trim() &&
    reactionToStrangers.trim() &&
    foodBehaviour.trim() &&
    interactionWithOtherAnimals.trim() &&
    assessmentDate &&
    outcome;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
      {isReassessment && (
        <p className="text-sm text-text">
          This is a Behaviour Program reassessment - it is recorded as a new entry, not an edit
          of the original assessment.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="ta-handling" className="text-xs font-semibold text-text-muted">Handling Response</label>
          <input
            id="ta-handling"
            type="text"
            value={handlingResponse}
            onChange={(e) => setHandlingResponse(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ta-strangers" className="text-xs font-semibold text-text-muted">Reaction to Strangers</label>
          <input
            id="ta-strangers"
            type="text"
            value={reactionToStrangers}
            onChange={(e) => setReactionToStrangers(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ta-food" className="text-xs font-semibold text-text-muted">Food Behaviour</label>
          <input
            id="ta-food"
            type="text"
            value={foodBehaviour}
            onChange={(e) => setFoodBehaviour(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ta-interaction" className="text-xs font-semibold text-text-muted">
            Interaction with Other Animals
          </label>
          <input
            id="ta-interaction"
            type="text"
            value={interactionWithOtherAnimals}
            onChange={(e) => setInteractionWithOtherAnimals(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ta-socialisation" className="text-xs font-semibold text-text-muted">
            Socialisation Score (1-5)
          </label>
          <select
            id="ta-socialisation"
            value={socialisationScore}
            onChange={(e) => setSocialisationScore(Number(e.target.value))}
            className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {SOCIALISATION_SCORES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ta-date" className="text-xs font-semibold text-text-muted">Assessment Date</label>
          <input
            id="ta-date"
            type="date"
            value={assessmentDate}
            max={todayDate()}
            onChange={(e) => setAssessmentDate(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ta-observations" className="text-xs font-semibold text-text-muted">Observations</label>
        <textarea
          id="ta-observations"
          rows={2}
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ta-recommendations" className="text-xs font-semibold text-text-muted">Recommendations</label>
        <textarea
          id="ta-recommendations"
          rows={2}
          value={recommendations}
          onChange={(e) => setRecommendations(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          id="ta-followup"
          type="checkbox"
          checked={followUpRequired}
          onChange={(e) => setFollowUpRequired(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        Follow-up required
      </label>
      {followUpRequired && (
        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label htmlFor="ta-reassessment-date" className="text-xs font-semibold text-text-muted">Reassessment Date</label>
          <input
            id="ta-reassessment-date"
            type="date"
            value={reassessmentDate}
            onChange={(e) => setReassessmentDate(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="ta-outcome" className="text-xs font-semibold text-text-muted">Outcome</label>
        <select
          id="ta-outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as TemperamentAssessmentInput["outcome"])}
          className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <option value="">Select</option>
          {BEHAVIOUR_OUTCOMES.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              handlingResponse,
              reactionToStrangers,
              foodBehaviour,
              interactionWithOtherAnimals,
              socialisationScore,
              observations,
              recommendations,
              assessmentDate,
              followUpRequired,
              reassessmentDate: followUpRequired ? reassessmentDate : undefined,
              outcome: outcome as TemperamentAssessmentInput["outcome"],
            })
          }
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Temperament Assessment
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

function BehaviourContent({
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
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [assessments, setAssessments] = useState<TemperamentAssessment[]>([]);
  const [programs, setPrograms] = useState<BehaviourProgram[]>([]);
  const [showForm, setShowForm] = useState(false);

  const canAct = CAN_ACT_ROLES.includes(role);

  useEffect(() => {
    let cancelled = false;
    getAnimalById(animalId).then((result) => {
      if (cancelled) return;
      setAnimal(result ?? null);
      if (result) {
        setAssessments(listTemperamentAssessments(animalId));
        setPrograms(listBehaviourPrograms(animalId));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  if (animal === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!animal) return <NotFound />;

  const activeProgram = programs.find((p) => p.status === "Active");

  const refresh = async () => {
    setAssessments(listTemperamentAssessments(animalId));
    setPrograms(listBehaviourPrograms(animalId));
    await evaluatePreListingEligibility(animalId);
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
        <h1 className="mt-2 text-2xl font-bold text-text">Behavioural Assessment</h1>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId}
        </p>
        {!canAct && (
          <p className="mt-2 text-sm text-text-muted">
            Veterinarian can read Behavioural Assessment records but cannot modify them.
          </p>
        )}
      </div>

      {programs.length > 0 && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Behaviour Program</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {programs.map((p) => (
              <li key={p.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
                <StatusChip label={p.status} category={PROGRAM_STATUS_CATEGORY[p.status]} />
                <p className="mt-1 text-text-muted">Started {formatDateTime(p.createdAt)}</p>
                {p.resolvedAt && (
                  <p className="text-text-muted">Resolved {formatDateTime(p.resolvedAt)}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">
          Temperament Assessments <span aria-hidden="true">*</span>
        </h2>
        {assessments.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No temperament assessments recorded yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {assessments.map((a) => (
              <li key={a.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-text">{formatDate(a.assessmentDate)}</span>
                  <StatusChip label={a.outcome} category={OUTCOME_CATEGORY[a.outcome]} />
                </div>
                {a.programReassessmentOf && (
                  <p className="mt-1 text-xs text-text-muted">Behaviour Program reassessment</p>
                )}
                <p className="mt-1 text-text">
                  Handling: {a.handlingResponse} &middot; Strangers: {a.reactionToStrangers}
                </p>
                <p className="text-text-muted">
                  Food: {a.foodBehaviour} &middot; With other animals:{" "}
                  {a.interactionWithOtherAnimals} &middot; Socialisation: {a.socialisationScore}/5
                </p>
                {a.observations && <p className="mt-1 text-text-muted">{a.observations}</p>}
                {a.recommendations && (
                  <p className="mt-1 text-text-muted">Recommendations: {a.recommendations}</p>
                )}
                {a.followUpRequired && (
                  <p className="mt-1 text-text-muted">
                    Follow-up required
                    {a.reassessmentDate ? ` by ${formatDate(a.reassessmentDate)}` : ""}
                  </p>
                )}
                <p className="mt-1 text-xs text-text-muted">
                  {a.assessorName} &middot; {formatDateTime(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canAct && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Record Temperament Assessment
          </button>
        )}
        {canAct && showForm && (
          <TemperamentAssessmentForm
            isReassessment={Boolean(activeProgram)}
            onCancel={() => setShowForm(false)}
            onSubmit={async (input) => {
              await recordTemperamentAssessment(animalId, input, email, displayName);
              setShowForm(false);
              refresh();
            }}
          />
        )}
      </section>
    </div>
  );
}

export function BehaviourScreen() {
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
      <BehaviourContent
        animalId={params.animalId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
