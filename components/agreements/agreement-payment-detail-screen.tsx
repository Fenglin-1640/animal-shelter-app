"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { ApplicationJourneyRail } from "@/components/process/application-journey-section";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getActiveAgreementForApplication, signAgreement } from "@/lib/agreements/store";
import { AGREEMENT_STATUS_CATEGORY, getAgreementStatus } from "@/lib/agreements/status";
import type { AdoptionAgreement } from "@/lib/agreements/types";
import { getLatestPaymentForAgreement, initiatePayment } from "@/lib/payments/store";
import { PAYMENT_STATUS_CATEGORY } from "@/lib/payments/status";
import type { AdoptionPayment } from "@/lib/payments/types";
import { getActiveValues } from "@/lib/system-administration/store";
import type { Role } from "@/lib/roles/roles";
import { formatDateTime } from "@/lib/shared/dates";

const ALLOWED_ROLES: Role[] = ["Adopter"];

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Agreement not found.</p>
      <Link
        href="/my-agreements"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to My Agreements
      </Link>
    </div>
  );
}

function PaymentSection({ agreement, email, displayName }: { agreement: AdoptionAgreement; email: string; displayName: string }) {
  const [payment, setPayment] = useState<AdoptionPayment | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [methods, setMethods] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getLatestPaymentForAgreement(agreement.agreementId).then((result) => {
      if (!cancelled) setPayment(result);
    });
    return () => {
      cancelled = true;
    };
  }, [agreement.agreementId]);

  useEffect(() => {
    let cancelled = false;
    getActiveValues("Payment Method").then((result) => {
      if (cancelled) return;
      setMethods(result);
      setPaymentMethod((prev) => prev || result[0] || "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => setPayment(await getLatestPaymentForAgreement(agreement.agreementId));

  const handlePay = async () => {
    if (!paymentMethod) return;
    await initiatePayment(agreement.agreementId, paymentMethod, email, displayName);
    await refresh();
  };

  return (
    <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <h2 className="text-lg font-bold text-text">Payment</h2>
      <p className="mt-1 text-xs text-text-muted">
        Pay the adoption fee to complete your adoption. Shelter Staff will confirm the payment.
      </p>

      {!payment || payment.paymentStatus === "Failed" ? (
        <div className="mt-4 flex flex-col gap-2">
          {payment?.paymentStatus === "Failed" && (
            <p className="text-sm text-danger">
              Previous attempt failed: {payment.failureReason}
            </p>
          )}
          <label htmlFor="payment-method" className="text-sm font-semibold text-text">
            Payment Method
          </label>
          <select
            id="payment-method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="h-9 w-fit rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handlePay}
            disabled={!paymentMethod}
            className="h-9 w-fit rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {payment?.paymentStatus === "Failed" ? "Try Again" : "Pay Now"}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={payment.paymentStatus} category={PAYMENT_STATUS_CATEGORY[payment.paymentStatus]} />
            <span className="text-sm text-text">${payment.amount}</span>
          </div>
          <p className="text-sm text-text-muted">
            {payment.paymentMethod} &middot; {formatDateTime(payment.paymentDate)}
          </p>
          {payment.paymentStatus === "Pending" && (
            <p className="mt-1 text-sm text-text-muted">
              Waiting for Shelter Staff to verify your payment.
            </p>
          )}
          {payment.paymentStatus === "Cleared" && (
            <p className="mt-1 text-sm text-text">
              Receipt: <span className="font-mono">{payment.receiptNumber}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function AgreementPaymentDetailContent({ applicationId, email, displayName }: { applicationId: string; email: string; displayName: string }) {
  const [agreement, setAgreement] = useState<AdoptionAgreement | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getActiveAgreementForApplication(applicationId).then((result) => {
      if (!cancelled) setAgreement(result ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (agreement === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!agreement) return <NotFound />;
  if (agreement.adopterEmail.toLowerCase() !== email.toLowerCase()) return <AccessDenied />;

  const status = getAgreementStatus(agreement.isSigned);
  const refresh = async () => setAgreement((await getActiveAgreementForApplication(applicationId)) ?? null);

  const handleSign = async () => {
    await signAgreement(agreement.agreementId, email, displayName);
    await refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/my-agreements"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to My Agreements
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">Adoption Agreement for {agreement.animalName}</h1>
          <StatusChip label={status} category={AGREEMENT_STATUS_CATEGORY[status]} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {agreement.agreementId} &middot; {agreement.agreementVersion}
        </p>
      </div>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Terms</h2>
        <p className="mt-2 text-sm text-text">{agreement.adoptionConditions}</p>
        <p className="mt-2 text-sm text-text-muted">Return policy period: {agreement.returnPolicyPeriod}</p>
        <p className="mt-2 text-sm text-text-muted">Generated {formatDateTime(agreement.generatedAt)}</p>

        {agreement.isSigned ? (
          <p className="mt-4 text-sm text-text">
            Signed by you on {agreement.signedDate ? formatDateTime(agreement.signedDate) : ""}. This
            agreement can no longer be edited.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleSign}
            className="mt-4 h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90"
          >
            Sign Adoption Agreement
          </button>
        )}
      </section>

      <PaymentSection agreement={agreement} email={email} displayName={displayName} />
    </div>
  );
}

export function AgreementPaymentDetailScreen() {
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
    <AppShell rightPanel={<ApplicationJourneyRail applicationId={params.applicationId} />}>
      <AgreementPaymentDetailContent
        applicationId={params.applicationId}
        email={user.email}
        displayName={user.displayName}
      />
    </AppShell>
  );
}
