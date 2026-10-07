"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { ApplicationDocuments } from "@/components/applications/application-documents";
import { ApplicationReviewPanel } from "@/components/applications/application-review-panel";
import { StaffApplicationRail } from "@/components/process/application-journey-section";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getApplication } from "@/lib/applications/store";
import { APPLICATION_STATUS_CATEGORY } from "@/lib/applications/status";
import type { AdoptionApplication } from "@/lib/applications/types";
import { completeCheck, listChecksForApplication } from "@/lib/checks/store";
import type { CheckOutcome, SuitabilityCheck } from "@/lib/checks/types";
import {
  getMeetAndGreetForApplication,
  proposeSlots,
  recordOutcome,
} from "@/lib/meet-and-greets/store";
import { MEET_AND_GREET_STATUS_CATEGORY } from "@/lib/meet-and-greets/status";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
const CAN_ACT_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];
const OUTCOME_OPTIONS: Exclude<CheckOutcome, "Pending">[] = ["Pass", "Concern", "Fail"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function outcomeCategory(outcome: CheckOutcome) {
  if (outcome === "Pass") return "success" as const;
  if (outcome === "Pending") return "neutral" as const;
  return "attention" as const;
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Application not found.</p>
      <Link
        href="/adoption-applications"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Adoption Applications
      </Link>
    </div>
  );
}

function CheckRow({
  check,
  canAct,
  onComplete,
}: {
  check: SuitabilityCheck;
  canAct: boolean;
  onComplete: (checkId: string, outcome: Exclude<CheckOutcome, "Pending">, notes: string, date: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [outcome, setOutcome] = useState<Exclude<CheckOutcome, "Pending">>("Pass");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayDate());

  return (
    <div className="rounded-[12px] border border-border bg-page p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">{check.checkType}</p>
        <StatusChip label={check.outcome} category={outcomeCategory(check.outcome)} />
      </div>
      {check.outcome !== "Pending" ? (
        <div className="mt-2 text-sm text-text">
          <p>{check.checkNotes}</p>
          <p className="mt-1 text-xs text-text-muted">
            {check.completedByName} &middot;{" "}
            {check.conductedDate ? formatDateTime(check.conductedDate) : ""}
          </p>
        </div>
      ) : canAct ? (
        showForm ? (
          <div className="mt-3 flex flex-col gap-2">
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as Exclude<CheckOutcome, "Pending">)}
              className="h-9 rounded-[12px] border border-border bg-surface px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Check notes"
              className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            <input
              type="date"
              value={date}
              max={todayDate()}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-40 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!notes.trim()}
                onClick={() => {
                  onComplete(check.checkId, outcome, notes, date);
                  setShowForm(false);
                }}
                className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-3 h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Complete Check
          </button>
        )
      ) : (
        <p className="mt-2 text-xs text-text-muted">Not yet completed.</p>
      )}
    </div>
  );
}

function MeetAndGreetSection({
  applicationId,
  canAct,
  email,
  displayName,
  onChanged,
}: {
  applicationId: string;
  canAct: boolean;
  email: string;
  displayName: string;
  // The outcome can change the application's status (Incompatible rejects it).
  onChanged: () => void;
}) {
  const [meetAndGreet, setMeetAndGreet] = useState<MeetAndGreet | null | undefined>(undefined);
  const [slots, setSlots] = useState([{ dateTime: "", location: "" }]);
  const [participants, setParticipants] = useState("");
  const [outcome, setOutcome] = useState<"Compatible" | "Incompatible">("Compatible");
  const [outcomeReason, setOutcomeReason] = useState("");
  const [staffNotes, setStaffNotes] = useState("");
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMeetAndGreetForApplication(applicationId).then((result) => {
      if (!cancelled) setMeetAndGreet(result ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const refresh = async () => setMeetAndGreet((await getMeetAndGreetForApplication(applicationId)) ?? null);

  const handleProposeSlots = async () => {
    const validSlots = slots.filter((s) => s.dateTime && s.location.trim());
    if (validSlots.length === 0) return;
    await proposeSlots(
      applicationId,
      validSlots.map((s) => ({ dateTime: new Date(s.dateTime).toISOString(), location: s.location })),
      participants,
      email,
      displayName,
    );
    await refresh();
  };

  const handleRecordOutcome = async () => {
    if (!meetAndGreet) return;
    if (outcome === "Incompatible" && !outcomeReason.trim()) return;
    await recordOutcome(meetAndGreet.meetAndGreetId, outcome, outcomeReason, staffNotes, email, displayName);
    setShowOutcomeForm(false);
    await refresh();
    onChanged();
  };

  if (meetAndGreet === undefined) {
    return (
      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Meet and Greet</h2>
        <p className="mt-2 text-sm text-text-muted">Loading...</p>
      </section>
    );
  }

  if (!meetAndGreet) {
    if (!canAct) {
      return (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Meet and Greet</h2>
          <p className="mt-2 text-sm text-text-muted">Not yet scheduled.</p>
        </section>
      );
    }
    return (
      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Schedule Meet and Greet</h2>
        <p className="mt-1 text-sm text-text-muted">
          Propose one or more time slot options - the Adopter will pick one.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {slots.map((slot, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <input
                type="datetime-local"
                value={slot.dateTime}
                onChange={(e) =>
                  setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, dateTime: e.target.value } : s)))
                }
                className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              <input
                type="text"
                placeholder="Location"
                value={slot.location}
                onChange={(e) =>
                  setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, location: e.target.value } : s)))
                }
                className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSlots((prev) => [...prev, { dateTime: "", location: "" }])}
            className="h-8 w-fit rounded-[12px] border border-border bg-page px-3 text-xs font-semibold text-text hover:bg-surface-active"
          >
            Add Another Option
          </button>
          <input
            type="text"
            placeholder="Participants (e.g. Adopter, Staff name)"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          <button
            type="button"
            onClick={handleProposeSlots}
            className="h-9 w-fit rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
          >
            Propose Slots
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-text">Meet and Greet</h2>
        <StatusChip
          label={meetAndGreet.status}
          category={MEET_AND_GREET_STATUS_CATEGORY[meetAndGreet.status]}
        />
      </div>
      {meetAndGreet.status === "Proposed" && (
        <p className="mt-2 text-sm text-text-muted">Waiting for the Adopter to select a time.</p>
      )}
      {meetAndGreet.status !== "Proposed" && (
        <>
          <p className="mt-2 text-sm text-text">
            {meetAndGreet.scheduledDate ? formatDateTime(meetAndGreet.scheduledDate) : ""} &middot;{" "}
            {meetAndGreet.location}
          </p>
          <p className="text-sm text-text-muted">
            Attendance: {meetAndGreet.attendanceConfirmed ? "Confirmed" : "Not yet confirmed"}
          </p>
        </>
      )}
      {meetAndGreet.status === "Scheduled" && canAct && (
        <div className="mt-4">
          {showOutcomeForm ? (
            <div className="flex flex-col gap-2">
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as "Compatible" | "Incompatible")}
                className="h-9 w-fit rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <option value="Compatible">Compatible</option>
                <option value="Incompatible">Incompatible</option>
              </select>
              <textarea
                rows={2}
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                placeholder="Staff notes"
                className="rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              {outcome === "Incompatible" && (
                <textarea
                  rows={2}
                  value={outcomeReason}
                  onChange={(e) => setOutcomeReason(e.target.value)}
                  placeholder="Reason (required, shown to the Adopter)"
                  className="rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={outcome === "Incompatible" && !outcomeReason.trim()}
                  onClick={handleRecordOutcome}
                  className="h-9 w-fit rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save Outcome
                </button>
                <button
                  type="button"
                  onClick={() => setShowOutcomeForm(false)}
                  className="h-9 w-fit rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowOutcomeForm(true)}
              className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Record Outcome
            </button>
          )}
        </div>
      )}
      {meetAndGreet.status === "Incompatible" && (
        <p className="mt-2 text-sm text-danger">Reason: {meetAndGreet.outcomeReason}</p>
      )}
    </section>
  );
}

function AdoptionApplicationDetailContent({
  applicationId,
  email,
  displayName,
  role,
}: {
  applicationId: string;
  email: string;
  displayName: string;
  role: Role;
}) {
  const [application, setApplication] = useState<AdoptionApplication | null | undefined>(undefined);
  const [checks, setChecks] = useState<SuitabilityCheck[]>([]);

  const canAct = CAN_ACT_ROLES.includes(role);
  // Supporting documents are for Shelter Staff and Administrators.
  const canSeeDocuments = role !== "Veterinarian";

  const refresh = async () => {
    const [applicationResult, checksResult] = await Promise.all([
      getApplication(applicationId),
      listChecksForApplication(applicationId),
    ]);
    setApplication(applicationResult ?? null);
    setChecks(checksResult);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getApplication(applicationId), listChecksForApplication(applicationId)]).then(
      ([applicationResult, checksResult]) => {
        if (cancelled) return;
        setApplication(applicationResult ?? null);
        setChecks(checksResult);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (application === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!application) return <NotFound />;

  const handleCompleteCheck = async (
    checkId: string,
    outcome: Exclude<CheckOutcome, "Pending">,
    notes: string,
    date: string,
  ) => {
    await completeCheck(checkId, outcome, notes, new Date(date).toISOString(), email, displayName);
    await refresh();
  };

  const snapshot = application.profileSnapshot;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/adoption-applications"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to Adoption Applications
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">
            {application.animalName} &middot; {application.adopterName}
          </h1>
          <StatusChip
            label={application.applicationStatus}
            category={APPLICATION_STATUS_CATEGORY[application.applicationStatus]}
          />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {application.applicationId} &middot; {application.animalSpecies} &middot;{" "}
          {application.animalBreed}
        </p>
      </div>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Motivation Statement</h2>
        <p className="mt-2 text-sm text-text">{application.motivationStatement}</p>
        {canSeeDocuments && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-text">Supporting Documents</h3>
            <ApplicationDocuments applicationId={application.applicationId} documents={application.documents} canEdit={false} />
          </>
        )}
      </section>

      {snapshot && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Adopter Profile Snapshot</h2>
          <p className="mt-1 text-xs text-text-muted">
            A read-only snapshot taken at submission time - later edits to the Adopter&apos;s live
            Profile do not change this.
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Address</dt>
              <dd className="text-sm text-text">{snapshot.residentialAddress}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Household</dt>
              <dd className="text-sm text-text">
                {snapshot.householdType} &middot; {snapshot.homeOwnership}
                {snapshot.homeOwnership === "Rent" ? (snapshot.landlordPermission ? " (landlord permission given)" : " (landlord permission NOT given)") : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Adults / Children</dt>
              <dd className="text-sm text-text">
                {snapshot.adultsInHousehold} adults, {snapshot.childrenInHousehold || "0"} children
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Existing Pets</dt>
              <dd className="text-sm text-text">
                {snapshot.hasExistingPets ? snapshot.existingPetDetails : "None"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Environment</dt>
              <dd className="text-sm text-text">{snapshot.environmentDetails}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Hours Alone</dt>
              <dd className="text-sm text-text">{snapshot.hoursAlone}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Referee</dt>
              <dd className="text-sm text-text">
                {snapshot.refereeName} ({snapshot.refereeRelationship}) &middot; {snapshot.refereePhone} &middot;{" "}
                {snapshot.refereeEmail}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Suitability Checks</h2>
        <div className="mt-4 flex flex-col gap-3">
          {checks.map((check) => (
            <CheckRow key={check.checkId} check={check} canAct={canAct} onComplete={handleCompleteCheck} />
          ))}
        </div>
      </section>

      <ApplicationReviewPanel
        application={application}
        checks={checks}
        canAct={canAct}
        email={email}
        displayName={displayName}
        onChanged={refresh}
      />

      {application.applicationStatus === "Approved" && (
        <>
          <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
            <p className="text-sm text-text">
              Approved by {application.decisionByName} on{" "}
              {application.decisionDate ? formatDateTime(application.decisionDate) : ""}.
            </p>
          </section>
          <MeetAndGreetSection
            applicationId={application.applicationId}
            canAct={canAct}
            email={email}
            displayName={displayName}
            onChanged={() => void refresh()}
          />
        </>
      )}
      {application.applicationStatus === "Rejected" && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <p className="text-sm text-text">
            Rejected by {application.decisionByName} on{" "}
            {application.decisionDate ? formatDateTime(application.decisionDate) : ""}: {application.rejectionReason}
          </p>
        </section>
      )}
    </div>
  );
}

export function AdoptionApplicationDetailScreen() {
  const { user } = useAuth();
  const params = useParams<{ applicationId: string }>();
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  return (
    <AppShell rightPanel={<StaffApplicationRail applicationId={params.applicationId} />}>
      <AdoptionApplicationDetailContent
        applicationId={params.applicationId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
