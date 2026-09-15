"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import {
  getLatestPreReleaseCheck,
  isFitForRelease,
  listPreReleaseChecks,
  recordPreReleaseCheck,
  type PreReleaseCheckInput,
} from "@/lib/medical/store";
import type { PreReleaseCheck, PreReleaseFitnessResult } from "@/lib/medical/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
// PRD 9: Pre-Release Check is 只读 for Administrator, 只读并执行 release for
// Shelter Staff Member (the "执行 release" part is FR-REL-02's Release
// action, built separately - this screen is where the check itself is
// created/finalised), and 创建、finalise for Veterinarian only.
const CAN_ACT_ROLES: Role[] = ["Veterinarian"];

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

function PreReleaseCheckForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: PreReleaseCheckInput) => void;
  onCancel: () => void;
}) {
  const [checkDate, setCheckDate] = useState(todayDate());
  const [fitnessResult, setFitnessResult] = useState<PreReleaseFitnessResult>("Fit for Release");
  const [healthFindings, setHealthFindings] = useState("");
  const [medicationGuidance, setMedicationGuidance] = useState("");
  const [careInstructions, setCareInstructions] = useState("");

  const canSubmit = checkDate && healthFindings.trim() && careInstructions.trim();

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="prc-date" className="text-xs font-semibold text-text-muted">Check Date</label>
          <input
            id="prc-date"
            type="date"
            value={checkDate}
            max={todayDate()}
            onChange={(e) => setCheckDate(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="prc-fitness" className="text-xs font-semibold text-text-muted">Fitness Result</label>
          <select
            id="prc-fitness"
            value={fitnessResult}
            onChange={(e) => setFitnessResult(e.target.value as PreReleaseFitnessResult)}
            className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <option value="Fit for Release">Fit for Release</option>
            <option value="Health Concern">Health Concern</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="prc-findings" className="text-xs font-semibold text-text-muted">Health Findings</label>
        <textarea
          id="prc-findings"
          rows={2}
          value={healthFindings}
          onChange={(e) => setHealthFindings(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      {fitnessResult === "Health Concern" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="prc-medication" className="text-xs font-semibold text-text-muted">
            Medication Guidance
          </label>
          <textarea
            id="prc-medication"
            rows={2}
            value={medicationGuidance}
            onChange={(e) => setMedicationGuidance(e.target.value)}
            className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="prc-care" className="text-xs font-semibold text-text-muted">Care Instructions</label>
        <textarea
          id="prc-care"
          rows={2}
          value={careInstructions}
          onChange={(e) => setCareInstructions(e.target.value)}
          placeholder="Shown to the Adopter once the Animal is released"
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      {fitnessResult === "Health Concern" && (
        <p className="text-xs text-text-muted">
          Submitting will set this animal&apos;s status to Under Treatment. Once recovery is
          complete, a fresh Pre-Release Check will be required before Release.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({ checkDate, fitnessResult, healthFindings, medicationGuidance, careInstructions })
          }
          className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Pre-Release Check
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

function PreReleaseCheckContent({
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
  const [animal, setAnimal] = useState<Animal | undefined>(() => getAnimalById(animalId));
  const [checks, setChecks] = useState<PreReleaseCheck[]>(() => (animal ? listPreReleaseChecks(animalId) : []));
  const [showForm, setShowForm] = useState(false);

  const canAct = CAN_ACT_ROLES.includes(role);

  if (!animal) return <NotFound />;

  const refresh = () => {
    setAnimal(getAnimalById(animalId));
    setChecks(listPreReleaseChecks(animalId));
  };

  const latest = getLatestPreReleaseCheck(animalId);
  const fitForRelease = isFitForRelease(animalId);
  const canConduct = animal.currentStatus === "Awaiting Release";
  const underTreatment = animal.currentStatus === "Under Treatment";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/animals/${animalId}`}
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to {animal.name}&apos;s Profile
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text">Pre-Release Check</h1>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId} &middot; {animal.currentStatus}
        </p>
        {!canAct && (
          <p className="mt-2 text-sm text-text-muted">
            {role === "Shelter Staff Member"
              ? "Shelter Staff Member can read the Pre-Release Check history and execute the Release action once Fit for Release - only Veterinarian can create or finalise the check itself."
              : "Only Veterinarian can create or finalise a Pre-Release Check."}
          </p>
        )}
      </div>

      {fitForRelease && (
        <div className="rounded-[12px] border border-primary bg-primary/10 p-4 text-sm text-text">
          Fit for Release - Shelter Staff can now proceed with releasing this animal to the
          Adopter.
        </div>
      )}
      {underTreatment && (
        <div className="rounded-[12px] border border-gold bg-gold/10 p-4 text-sm text-text">
          This animal is Under Treatment following a Health Concern outcome. Record treatment
          progress on the{" "}
          <Link href={`/animals/${animalId}/medical`} className="font-semibold underline underline-offset-2">
            Medical Record
          </Link>{" "}
          - once recovery is complete, a fresh Pre-Release Check will be required here.
        </div>
      )}

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Check History</h2>
        {checks.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No Pre-Release Check has been recorded yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {checks.map((c) => (
              <li key={c.id} className="rounded-[12px] border border-border bg-page p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-text">{formatDate(c.checkDate)}</span>
                  <StatusChip
                    label={c.fitnessResult}
                    category={c.fitnessResult === "Fit for Release" ? "success" : "attention"}
                  />
                </div>
                <p className="mt-1 text-text">{c.healthFindings}</p>
                {c.medicationGuidance && (
                  <p className="mt-1 text-text-muted">Medication guidance: {c.medicationGuidance}</p>
                )}
                <p className="mt-1 text-text-muted">Care instructions: {c.careInstructions}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {c.veterinarianName} &middot; {formatDateTime(c.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canAct && canConduct && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            {latest ? "Record New Pre-Release Check" : "Conduct Pre-Release Check"}
          </button>
        )}
        {canAct && canConduct && showForm && (
          <PreReleaseCheckForm
            onCancel={() => setShowForm(false)}
            onSubmit={(input) => {
              recordPreReleaseCheck(animalId, input, email, displayName);
              setShowForm(false);
              refresh();
            }}
          />
        )}
        {canAct && !canConduct && !underTreatment && (
          <p className="mt-4 text-xs text-text-muted">
            A Pre-Release Check can only be conducted while this animal is Awaiting Release.
          </p>
        )}
      </section>
    </div>
  );
}

export function PreReleaseCheckScreen() {
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
      <PreReleaseCheckContent
        animalId={params.animalId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
