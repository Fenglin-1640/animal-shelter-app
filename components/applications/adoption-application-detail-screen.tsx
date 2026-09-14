"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import {
  approveApplication,
  getApplication,
  rejectApplication,
} from "@/lib/applications/store";
import { APPLICATION_STATUS_CATEGORY } from "@/lib/applications/status";
import type { AdoptionApplication } from "@/lib/applications/types";
import {
  allChecksComplete,
  allChecksPass,
  completeCheck,
  listChecksForApplication,
} from "@/lib/checks/store";
import type { CheckOutcome, SuitabilityCheck } from "@/lib/checks/types";
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
  const [application, setApplication] = useState<AdoptionApplication | undefined>(() =>
    getApplication(applicationId),
  );
  const [checks, setChecks] = useState<SuitabilityCheck[]>(() =>
    application ? listChecksForApplication(applicationId) : [],
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const canAct = CAN_ACT_ROLES.includes(role);

  if (!application) return <NotFound />;

  const refresh = () => {
    setApplication(getApplication(applicationId));
    setChecks(listChecksForApplication(applicationId));
  };

  const handleCompleteCheck = (
    checkId: string,
    outcome: Exclude<CheckOutcome, "Pending">,
    notes: string,
    date: string,
  ) => {
    completeCheck(checkId, outcome, notes, new Date(date).toISOString(), email, displayName);
    refresh();
  };

  const handleApprove = () => {
    approveApplication(applicationId, email, displayName);
    refresh();
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    rejectApplication(applicationId, rejectionReason, email, displayName);
    setShowRejectForm(false);
    refresh();
  };

  const checksComplete = allChecksComplete(applicationId);
  const checksPass = allChecksPass(applicationId);
  const canDecide = checksComplete && application.applicationStatus !== "Approved" && application.applicationStatus !== "Rejected";
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
        {application.documents.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-text">Supporting Documents</h3>
            <ul className="mt-1 flex flex-col gap-1">
              {application.documents.map((d) => (
                <li key={d.id} className="text-sm text-text-muted">
                  {d.fileName}
                </li>
              ))}
            </ul>
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

      {canAct && canDecide && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Decision</h2>
          {!checksComplete ? (
            <p className="mt-2 text-sm text-text-muted">
              All 3 suitability checks must be completed before a decision can be made.
            </p>
          ) : checksPass ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleApprove}
                className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90"
              >
                Approve Application
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-sm text-text">
                At least one check raised a Concern or Fail - a rejection reason is required.
              </p>
              {showRejectForm ? (
                <>
                  <textarea
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Rejection reason (shown to the Adopter)"
                    className="rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!rejectionReason.trim()}
                      onClick={handleReject}
                      className="h-9 rounded-[12px] bg-danger px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Confirm Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  className="h-10 w-fit rounded-[12px] border border-danger bg-surface px-5 text-sm font-semibold text-danger hover:bg-surface-active"
                >
                  Reject Application
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {application.applicationStatus === "Approved" && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <p className="text-sm text-text">
            Approved by {application.decisionByName} on{" "}
            {application.decisionDate ? formatDateTime(application.decisionDate) : ""}.
          </p>
        </section>
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
    <AppShell>
      <AdoptionApplicationDetailContent
        applicationId={params.applicationId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
