"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { finaliseAdoption, getFinaliseBlockers } from "@/lib/adoptions/finalise";
import { generateAgreement, getActiveAgreementForApplication } from "@/lib/agreements/store";
import { AGREEMENT_STATUS_CATEGORY, getAgreementStatus } from "@/lib/agreements/status";
import type { AdoptionAgreement } from "@/lib/agreements/types";
import { getApplication } from "@/lib/applications/store";
import type { AdoptionApplication } from "@/lib/applications/types";
import { getMeetAndGreetForApplication } from "@/lib/meet-and-greets/store";
import { getLatestPaymentForAgreement, verifyPayment } from "@/lib/payments/store";
import { PAYMENT_STATUS_CATEGORY } from "@/lib/payments/status";
import type { AdoptionPayment } from "@/lib/payments/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
const CAN_MANAGE_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Adoption not found.</p>
      <Link
        href="/adoptions"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Adoptions
      </Link>
    </div>
  );
}

function AgreementSection({
  applicationId,
  canManage,
  email,
  displayName,
  isCompatible,
}: {
  applicationId: string;
  canManage: boolean;
  email: string;
  displayName: string;
  isCompatible: boolean;
}) {
  const [agreement, setAgreement] = useState<AdoptionAgreement | undefined>(() =>
    getActiveAgreementForApplication(applicationId),
  );

  const refresh = () => setAgreement(getActiveAgreementForApplication(applicationId));

  const handleGenerate = () => {
    generateAgreement(applicationId, email, displayName);
    refresh();
  };

  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Adoption Agreement</h2>

      {!agreement ? (
        <>
          <p className="mt-2 text-sm text-text-muted">No agreement has been generated yet.</p>
          {canManage && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!isCompatible}
              title={!isCompatible ? "Only available once the Meet and Greet outcome is Compatible" : undefined}
              className="mt-3 h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Generate Adoption Agreement
            </button>
          )}
        </>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip
              label={getAgreementStatus(agreement.isSigned)}
              category={AGREEMENT_STATUS_CATEGORY[getAgreementStatus(agreement.isSigned)]}
            />
            <span className="text-sm text-text-muted">{agreement.agreementVersion}</span>
          </div>
          <p className="mt-2 text-sm text-text">{agreement.adoptionConditions}</p>
          <p className="mt-1 text-sm text-text-muted">Return policy: {agreement.returnPolicyPeriod}</p>
          <p className="mt-1 text-xs text-text-muted">Terms template {agreement.templateVersion}</p>
          <p className="mt-1 text-xs text-text-muted">
            Generated {formatDateTime(agreement.generatedAt)}
            {agreement.signedDate ? ` · Signed ${formatDateTime(agreement.signedDate)}` : " · Awaiting Adopter signature"}
          </p>
          {canManage && agreement.isSigned && (
            <button
              type="button"
              onClick={handleGenerate}
              className="mt-3 h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
            >
              Generate New Version
            </button>
          )}
        </>
      )}
    </section>
  );
}

function PaymentSection({
  applicationId,
  canManage,
  email,
  displayName,
  agreementId,
}: {
  applicationId: string;
  canManage: boolean;
  email: string;
  displayName: string;
  agreementId: string | undefined;
}) {
  const [payment, setPayment] = useState<AdoptionPayment | undefined>(() =>
    agreementId ? getLatestPaymentForAgreement(agreementId) : undefined,
  );
  const [failureReason, setFailureReason] = useState("");
  const [showFailForm, setShowFailForm] = useState(false);

  const refresh = () => setPayment(agreementId ? getLatestPaymentForAgreement(agreementId) : undefined);

  const handleClear = () => {
    if (!payment) return;
    verifyPayment(payment.paymentId, "Cleared", email, displayName);
    refresh();
  };

  const handleFail = () => {
    if (!payment || !failureReason.trim()) return;
    verifyPayment(payment.paymentId, "Failed", email, displayName, failureReason);
    setShowFailForm(false);
    setFailureReason("");
    refresh();
  };

  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Adoption Payment</h2>
      <p className="mt-1 text-xs text-text-muted">
        Simulated payment only - no real payment gateway is connected.
      </p>

      {!agreementId ? (
        <p className="mt-2 text-sm text-text-muted">
          No agreement exists yet for {applicationId} to attach a payment to.
        </p>
      ) : !payment ? (
        <p className="mt-2 text-sm text-text-muted">The Adopter has not initiated a payment yet.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusChip label={payment.paymentStatus} category={PAYMENT_STATUS_CATEGORY[payment.paymentStatus]} />
            <span className="text-sm text-text">${payment.amount}</span>
            <span className="text-sm text-text-muted">{payment.paymentMethod}</span>
          </div>
          <p className="mt-1 text-xs text-text-muted">Submitted {formatDateTime(payment.paymentDate)}</p>

          {payment.paymentStatus === "Cleared" && (
            <p className="mt-2 text-sm text-text">
              Receipt: <span className="font-mono">{payment.receiptNumber}</span> &middot; verified by{" "}
              {payment.verifiedByName}
            </p>
          )}
          {payment.paymentStatus === "Failed" && (
            <p className="mt-2 text-sm text-danger">Reason: {payment.failureReason}</p>
          )}

          {canManage && payment.paymentStatus === "Pending" && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-9 rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
                >
                  Verify as Cleared
                </button>
                <button
                  type="button"
                  onClick={() => setShowFailForm((v) => !v)}
                  className="h-9 rounded-[12px] border border-danger bg-surface px-4 text-sm font-semibold text-danger hover:bg-surface-active"
                >
                  Mark as Failed
                </button>
              </div>
              {showFailForm && (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={2}
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    placeholder="Failure reason (required)"
                    className="rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                  <button
                    type="button"
                    disabled={!failureReason.trim()}
                    onClick={handleFail}
                    className="h-9 w-fit rounded-[12px] bg-danger px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Confirm Failed
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FinaliseSection({
  applicationId,
  canManage,
  email,
  displayName,
  isFinalised,
  onFinalised,
}: {
  applicationId: string;
  canManage: boolean;
  email: string;
  displayName: string;
  isFinalised: boolean;
  onFinalised: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // Recomputed on every render (not memoized) so it always reflects the
  // latest Agreement/Payment state after those sections' own actions.
  const blockers = isFinalised ? [] : getFinaliseBlockers(applicationId);

  const handleFinalise = async () => {
    const result = await finaliseAdoption(applicationId, email, displayName);
    if (!result.ok) {
      setError(result.blockers.length > 0 ? result.blockers.join(" ") : "Unable to finalise.");
      return;
    }
    setError(null);
    onFinalised();
  };

  if (!canManage && !isFinalised) return null;

  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Finalise Adoption Record</h2>

      {isFinalised ? (
        <p className="mt-2 text-sm text-text">
          This adoption has been finalised. The Animal is now Awaiting Release, and a
          Pre-Release Check is required before the Animal can be released to the Adopter.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-text-muted">
            Finalising requires a Compatible Meet and Greet, a signed Adoption Agreement and a
            Cleared Adoption Payment, all verified together.
          </p>
          {blockers.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {blockers.map((b) => (
                <li key={b} className="text-sm text-text-muted">
                  &bull; {b}
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button
            type="button"
            onClick={handleFinalise}
            disabled={blockers.length > 0}
            className="mt-3 h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Finalise Adoption Record
          </button>
        </>
      )}
    </section>
  );
}

function AdoptionDetailContent({
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
  const meetAndGreet = getMeetAndGreetForApplication(applicationId);
  const agreement = getActiveAgreementForApplication(applicationId);

  if (!application) return <NotFound />;

  const canManage = CAN_MANAGE_ROLES.includes(role);
  const canSeePayment = role !== "Veterinarian";
  const isCompatible = meetAndGreet?.status === "Compatible";
  const isFinalised = application.applicationStatus === "Finalised";
  const refreshApplication = () => setApplication(getApplication(applicationId));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/adoptions"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to Adoptions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">
            {application.animalName} &middot; {application.adopterName}
          </h1>
          <StatusChip label={application.applicationStatus} category="progress" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {application.applicationId} &middot; {application.animalSpecies} &middot; {application.animalBreed}
        </p>
      </div>

      {!isCompatible && application.applicationStatus !== "Finalised" && (
        <div className="rounded-[12px] border border-gold bg-gold/10 p-4 text-sm text-text">
          This application&apos;s Meet and Greet is not yet marked Compatible - Agreement
          generation is unavailable until then.
        </div>
      )}

      <AgreementSection
        applicationId={applicationId}
        canManage={canManage}
        email={email}
        displayName={displayName}
        isCompatible={isCompatible}
      />

      {canSeePayment && (
        <PaymentSection
          applicationId={applicationId}
          canManage={canManage}
          email={email}
          displayName={displayName}
          agreementId={agreement?.agreementId}
        />
      )}

      {canSeePayment && (
        <FinaliseSection
          applicationId={applicationId}
          canManage={canManage}
          email={email}
          displayName={displayName}
          isFinalised={isFinalised}
          onFinalised={refreshApplication}
        />
      )}
    </div>
  );
}

export function AdoptionDetailScreen() {
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
      <AdoptionDetailContent
        applicationId={params.applicationId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
