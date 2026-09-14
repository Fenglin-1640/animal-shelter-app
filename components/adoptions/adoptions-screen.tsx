"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getActiveAgreementForApplication } from "@/lib/agreements/store";
import { listAllApplications } from "@/lib/applications/store";
import { getMeetAndGreetForApplication } from "@/lib/meet-and-greets/store";
import { getLatestPaymentForAgreement } from "@/lib/payments/store";
import type { Role } from "@/lib/roles/roles";
import type { StatusCategory } from "@/lib/shared/status-category";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];

// Adoptions only lists applications past the point PRD 6.12 names as the
// entry into this stage: "Compatible 进入协议和付款阶段".
function isInAdoptionsStage(applicationStatus: string, meetAndGreetStatus: string | undefined): boolean {
  if (applicationStatus === "Finalised") return true;
  return applicationStatus === "Approved" && meetAndGreetStatus === "Compatible";
}

function computeStageLabel(
  applicationStatus: string,
  isSigned: boolean | undefined,
  paymentStatus: string | undefined,
): { label: string; category: StatusCategory } {
  if (applicationStatus === "Finalised") return { label: "Finalised", category: "complete" };
  if (!isSigned) return { label: "Awaiting Agreement Signature", category: "caution" };
  if (!paymentStatus) return { label: "Awaiting Payment", category: "caution" };
  if (paymentStatus === "Pending") return { label: "Payment Pending Verification", category: "caution" };
  if (paymentStatus === "Failed") return { label: "Payment Failed", category: "attention" };
  return { label: "Ready to Finalise", category: "progress" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function AdoptionsContent() {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return listAllApplications()
      .filter((a) => isInAdoptionsStage(a.applicationStatus, getMeetAndGreetForApplication(a.applicationId)?.status))
      .map((a) => {
        const agreement = getActiveAgreementForApplication(a.applicationId);
        const payment = agreement ? getLatestPaymentForAgreement(agreement.agreementId) : undefined;
        const stage = computeStageLabel(a.applicationStatus, agreement?.isSigned, payment?.paymentStatus);
        return { application: a, agreement, payment, stage };
      })
      .sort((a, b) => new Date(b.application.updatedAt).getTime() - new Date(a.application.updatedAt).getTime());
  }, []);

  const filtered = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const haystack = `${row.application.animalName} ${row.application.adopterName} ${row.application.applicationId}`.toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Adoptions</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage agreements, payments and finalisation for compatible adoptions.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="adoptions-search" className="sr-only">
          Search adoptions
        </label>
        <input
          id="adoptions-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by animal, adopter or application ID"
          className="h-10 min-w-[220px] flex-1 rounded-[12px] border border-border bg-surface px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">
            No adoptions are ready for an agreement yet.
          </p>
          <p className="mt-1 text-sm text-text-muted">
            An adoption enters this stage once its Meet and Greet outcome is Compatible.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map(({ application, stage }) => (
            <li key={application.applicationId}>
              <Link
                href={`/adoptions/${application.applicationId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)] hover:bg-surface-active"
              >
                <div>
                  <p className="text-sm font-semibold text-text">
                    {application.animalName} &middot; {application.adopterName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {application.applicationId}
                    {application.decisionDate ? ` · Approved ${formatDate(application.decisionDate)}` : ""}
                  </p>
                </div>
                <StatusChip label={stage.label} category={stage.category} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdoptionsScreen() {
  const { user } = useAuth();
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
      <AdoptionsContent />
    </AppShell>
  );
}
