"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApplicationJourneySection } from "@/components/process/application-journey-section";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAdopterProfile } from "@/lib/adopter-profile/store";
import { getAdopterProfileSubmissionBlockers, type AdopterProfile } from "@/lib/adopter-profile/types";
import { getApplication, submitApplication, updateDraft } from "@/lib/applications/store";
import { APPLICATION_STATUS_CATEGORY } from "@/lib/applications/status";
import type { AdoptionApplication } from "@/lib/applications/types";
import { ApplicationDocuments } from "@/components/applications/application-documents";
import { createChecksForApplication } from "@/lib/checks/store";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Adopter"];

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Application not found.</p>
      <Link
        href="/my-applications"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to My Applications
      </Link>
    </div>
  );
}

function nextStepMessage(application: AdoptionApplication): string | null {
  switch (application.applicationStatus) {
    case "Submitted":
    case "Under Review":
      return "Shelter Staff are reviewing your application. You'll be notified once a decision is made.";
    case "On Hold":
      return "This application is on hold while another applicant's process for this animal is decided.";
    case "Approved":
      return "Your application has been approved. Shelter Staff will schedule a Meet and Greet.";
    case "Finalised":
      return "This adoption has been finalised. Check My Meet and Greets and My Agreements for next steps.";
    default:
      return null;
  }
}

function ApplicationDetailContent({ applicationId, email }: { applicationId: string; email: string }) {
  const router = useRouter();
  const [application, setApplication] = useState<AdoptionApplication | null | undefined>(undefined);
  const [motivation, setMotivation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitBlockers, setSubmitBlockers] = useState<string[] | null>(null);
  const [profile, setProfile] = useState<AdopterProfile | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getApplication(applicationId).then((result) => {
      if (cancelled) return;
      setApplication(result ?? null);
      setMotivation(result?.motivationStatement ?? "");
    });
    getAdopterProfile(email).then((result) => {
      if (!cancelled) setProfile(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applicationId, email]);

  if (application === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!application) return <NotFound />;
  if (application.adopterEmail.toLowerCase() !== email.toLowerCase()) return <AccessDenied />;

  const isDraft = application.applicationStatus === "Draft";
  const liveBlockers = [
    ...(motivation.trim() ? [] : ["A motivation statement is required."]),
    ...(profile ? getAdopterProfileSubmissionBlockers(profile) : []),
  ];

  const handleSaveDraft = async () => {
    await updateDraft(applicationId, { motivationStatement: motivation });
    setApplication(await getApplication(applicationId));
  };

  const handleSubmit = async () => {
    setSubmitBlockers(null);
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await updateDraft(applicationId, { motivationStatement: motivation });
    const result = await submitApplication(applicationId);
    setIsSubmitting(false);

    if (!result.ok) {
      if (result.reason === "blocked") setSubmitBlockers(result.blockers ?? []);
      return;
    }

    await createChecksForApplication(applicationId);
    router.refresh();
    setApplication(await getApplication(applicationId));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/my-applications"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to My Applications
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">
            Application for {application.animalName}
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
        {nextStepMessage(application) && (
          <p className="mt-2 text-sm text-text">{nextStepMessage(application)}</p>
        )}
        {application.applicationStatus === "Rejected" && (
          <p className="mt-2 text-sm text-danger">
            Not successful: {application.rejectionReason}
          </p>
        )}
      </div>

      <ApplicationJourneySection applicationId={application.applicationId} />

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Motivation Statement</h2>
        {isDraft ? (
          <textarea
            rows={4}
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            onBlur={handleSaveDraft}
            placeholder="Tell us why you'd like to adopt this animal."
            className="mt-3 w-full rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        ) : (
          <p className="mt-2 text-sm text-text">{application.motivationStatement}</p>
        )}
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Supporting Documents</h2>
        <ApplicationDocuments
          applicationId={application.applicationId}
          documents={application.documents}
          canEdit={isDraft}
          onChanged={async () => setApplication(await getApplication(applicationId))}
        />
      </section>

      {isDraft && (
        <>
          {(submitBlockers ?? liveBlockers).length > 0 && (
            <div
              role="status"
              className="flex flex-col gap-1 rounded-[12px] border border-gold bg-gold/10 px-3 py-3 text-sm text-text"
            >
              <p className="font-semibold">Not ready to submit:</p>
              <ul className="list-inside list-disc">
                {(submitBlockers ?? liveBlockers).map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-text-muted">
                Missing Adopter Profile fields? Update{" "}
                <Link href="/my-adopter-profile" className="underline underline-offset-2">
                  My Adopter Profile
                </Link>{" "}
                first.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || liveBlockers.length > 0}
              className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ApplicationDetailScreen() {
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
      <ApplicationDetailContent applicationId={params.applicationId} email={user.email} />
    </AppShell>
  );
}
