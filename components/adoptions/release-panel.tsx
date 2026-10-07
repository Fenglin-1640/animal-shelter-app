"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusChip } from "@/components/shared/status-chip";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import { getLatestFollowUpVisitForAnimal, releaseAnimal } from "@/lib/follow-up-visits/store";
import type { FollowUpType, FollowUpVisit } from "@/lib/follow-up-visits/types";
import { listPreReleaseChecks } from "@/lib/medical/store";
import type { PreReleaseCheck } from "@/lib/medical/types";

// Local calendar dates (YYYY-MM-DD), so "today" matches the user's day.
function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-CA");
}

function formatDate(value: string): string {
  // Date-only values are read as local dates, not UTC midnight.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString("en-US", { dateStyle: "medium" });
}

const INPUT =
  "h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function ReleaseForm({
  animalId,
  defaultReceivingAdopter,
  careInstructions,
  onReleased,
}: {
  animalId: string;
  defaultReceivingAdopter: string;
  careInstructions: string;
  onReleased: (visit: FollowUpVisit) => void;
}) {
  const [releaseDate, setReleaseDate] = useState(localDate());
  const [receivingAdopter, setReceivingAdopter] = useState(defaultReceivingAdopter);
  const [targetDate, setTargetDate] = useState(localDate(7));
  const [followUpType, setFollowUpType] = useState<FollowUpType>("Phone Call");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = confirmed && receivingAdopter.trim() && releaseDate && targetDate && targetDate >= releaseDate && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    const result = await releaseAnimal(animalId, {
      careInstructionsProvided: confirmed,
      releaseDate,
      receivingAdopter,
      targetDate,
      followUpType,
      handoverNotes,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? "Unable to release this animal. Please reload and try again.");
      return;
    }
    onReleased(result.visit);
  };

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-page p-4">
      {careInstructions && (
        <p className="text-sm text-text">
          <span className="font-semibold">Care instructions to hand over:</span> {careInstructions}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="release-date" className="text-xs font-semibold text-text-muted">Release / Handover Date</label>
          <input id="release-date" type="date" value={releaseDate} max={localDate()} onChange={(e) => setReleaseDate(e.target.value)} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="receiving-adopter" className="text-xs font-semibold text-text-muted">Receiving Adopter</label>
          <input id="receiving-adopter" type="text" maxLength={200} value={receivingAdopter} onChange={(e) => setReceivingAdopter(e.target.value)} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="target-date" className="text-xs font-semibold text-text-muted">Follow-Up Visit Date</label>
          <input id="target-date" type="date" value={targetDate} min={releaseDate} onChange={(e) => setTargetDate(e.target.value)} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="follow-up-type" className="text-xs font-semibold text-text-muted">Follow-Up Type</label>
          <select id="follow-up-type" value={followUpType} onChange={(e) => setFollowUpType(e.target.value as FollowUpType)} className={INPUT}>
            <option value="Phone Call">Phone Call</option>
            <option value="Home Visit">Home Visit</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="handover-notes" className="text-xs font-semibold text-text-muted">Handover Notes (optional)</label>
        <textarea
          id="handover-notes"
          rows={2}
          maxLength={2000}
          value={handoverNotes}
          onChange={(e) => setHandoverNotes(e.target.value)}
          className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-text">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
        I confirm the animal has been handed over to the Adopter and the care instructions have been provided.
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Releasing..." : "Release to Adopter"}
        </button>
      </div>
    </div>
  );
}

// Release to Adopter, driven by the animal's status and its latest
// Pre-Release Check. Shelter Staff and Administrator can release once the
// Veterinarian has recorded Fit for Release; other roles see the status only.
export function ReleasePanel({
  animalId,
  adopterName,
  canRelease,
}: {
  animalId: string;
  adopterName: string;
  canRelease: boolean;
}) {
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [latestCheck, setLatestCheck] = useState<PreReleaseCheck | undefined>(undefined);
  const [visit, setVisit] = useState<FollowUpVisit | undefined>(undefined);
  const [justReleased, setJustReleased] = useState(false);

  const load = useCallback(async () => {
    const [a, checks, v] = await Promise.all([
      getAnimalById(animalId),
      listPreReleaseChecks(animalId),
      getLatestFollowUpVisitForAnimal(animalId),
    ]);
    setAnimal(a ?? null);
    setLatestCheck(checks[0]);
    setVisit(v);
  }, [animalId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAnimalById(animalId), listPreReleaseChecks(animalId), getLatestFollowUpVisitForAnimal(animalId)]).then(
      ([a, checks, v]) => {
        if (cancelled) return;
        setAnimal(a ?? null);
        setLatestCheck(checks[0]);
        setVisit(v);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  if (animal === undefined) {
    return (
      <section className="rounded-[12px] border border-border bg-surface p-6 text-sm text-text-muted">Loading release status...</section>
    );
  }
  if (!animal) return null;

  const released = animal.currentStatus === "inFollowUpPeriod" || animal.currentStatus === "Rehomed";
  const awaiting = animal.currentStatus === "Awaiting Release";
  const fit = awaiting && latestCheck?.fitnessResult === "Fit for Release";
  const preReleaseLink = (
    <Link href={`/animals/${animalId}/pre-release-check`} className="font-semibold underline underline-offset-2">
      Pre-Release Check
    </Link>
  );

  let body: React.ReactNode;
  if (released) {
    body = (
      <div role="status" className="mt-3 rounded-[12px] border border-primary bg-primary/10 p-4 text-sm text-text">
        <p className="font-semibold">{animal.name} has been released to the Adopter.</p>
        {visit && (
          <p className="mt-1">
            Released on {formatDate(visit.releaseDate)} to {visit.receivingAdopter}.{" "}
            {visit.status === "Completed" ? (
              <>Follow-up visit ({visit.followUpType}) completed - the animal is {animal.currentStatus}.</>
            ) : (
              <>
                Follow-up visit ({visit.followUpType}) scheduled for <strong>{formatDate(visit.targetDate)}</strong>.
              </>
            )}
          </p>
        )}
        {visit?.handoverNotes && <p className="mt-1 text-text-muted">Handover notes: {visit.handoverNotes}</p>}
        <Link href={`/animals/${animalId}/follow-up-visit`} className="mt-2 inline-block font-semibold underline underline-offset-2">
          Open the Follow-Up Visit
        </Link>
      </div>
    );
  } else if (!awaiting) {
    body = (
      <div className="mt-3 rounded-[12px] border border-gold bg-gold/10 p-4 text-sm text-text">
        <p className="font-semibold">Release is not available - the animal is {animal.currentStatus}.</p>
        {latestCheck?.fitnessResult === "Health Concern" && (
          <>
            <p className="mt-1">
              Latest Pre-Release Check ({formatDate(latestCheck.checkDate)}, {latestCheck.veterinarianName}): Health Concern -{" "}
              {latestCheck.healthFindings}
            </p>
            <p className="mt-1">A new {preReleaseLink} is required once treatment is complete.</p>
          </>
        )}
      </div>
    );
  } else if (!latestCheck) {
    body = (
      <div role="status" className="mt-3 rounded-[12px] border border-border bg-page p-4 text-sm text-text">
        <p className="font-semibold">Waiting for the Pre-Release Check (Veterinarian)</p>
        <p className="mt-1 text-text-muted">Release becomes available once the Veterinarian records the {preReleaseLink} as Fit for Release.</p>
      </div>
    );
  } else if (!fit) {
    body = (
      <div role="status" className="mt-3 rounded-[12px] border border-gold bg-gold/10 p-4 text-sm text-text">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Latest Pre-Release Check:</span>
          <StatusChip label={latestCheck.fitnessResult} category="attention" />
        </div>
        <p className="mt-1">{latestCheck.healthFindings}</p>
        {latestCheck.medicationGuidance && <p className="mt-1 text-text-muted">Medication guidance: {latestCheck.medicationGuidance}</p>}
        <p className="mt-1 text-xs text-text-muted">
          {latestCheck.veterinarianName} &middot; {formatDate(latestCheck.checkDate)}
        </p>
        <p className="mt-2 font-semibold">Release is blocked until the Veterinarian records a new {preReleaseLink}.</p>
      </div>
    );
  } else {
    body = (
      <>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text">
          <StatusChip label="Fit for Release" category="success" />
          <span className="text-text-muted">
            {latestCheck.veterinarianName} &middot; {formatDate(latestCheck.checkDate)}
          </span>
        </div>
        {canRelease ? (
          <ReleaseForm
            animalId={animalId}
            defaultReceivingAdopter={adopterName}
            careInstructions={latestCheck.careInstructions}
            onReleased={async (v) => {
              // Re-read the animal first, so the message and the released
              // state appear together.
              await load();
              setVisit(v);
              setJustReleased(true);
            }}
          />
        ) : (
          <p className="mt-2 text-sm text-text-muted">Waiting for Shelter Staff to release the animal to the Adopter.</p>
        )}
      </>
    );
  }

  return (
    <section
      id="release"
      className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]"
    >
      <h2 className="text-lg font-bold text-text">Release to Adopter</h2>
      {justReleased && visit && (
        <p role="alert" className="mt-2 rounded-[12px] border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-text">
          Released. The follow-up visit is scheduled for {formatDate(visit.targetDate)}.
        </p>
      )}
      {body}
    </section>
  );
}
