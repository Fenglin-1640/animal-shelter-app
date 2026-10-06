"use client";

import { useState } from "react";
import { approvalBlockers, approveApplication, rejectApplication, reviewApplication, type ReviewAction } from "@/lib/applications/store";
import { hasNewAdopterResponse, isWaitingOnAdopter, type AdoptionApplication } from "@/lib/applications/types";
import { CHECK_TYPES, type SuitabilityCheck } from "@/lib/checks/types";

const card = "rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]";
const primary = "h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const secondary = "h-10 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60";
const textarea =
  "rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

type Form = null | "reject" | "hold" | "request_info";

// The Shelter Staff / Administrator review of an application, driven by
// its status:
//   Submitted     Start Review (checks can already be recorded)
//   Under Review  Approve (all three checks Pass), Reject (reason),
//                 Place On Hold, Request more documents / information
//   On Hold       Resume Review (once the animal is available), Reject,
//                 Request more documents / information
// A request to the Adopter shows here until they upload a document; their
// upload is flagged for review. Every action is audited.
export function ApplicationReviewPanel({
  application,
  checks,
  canAct,
  email,
  displayName,
  onChanged,
}: {
  application: AdoptionApplication;
  checks: SuitabilityCheck[];
  canAct: boolean;
  email: string;
  displayName: string;
  onChanged: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<Form>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = application.applicationStatus;
  if (!["Submitted", "Under Review", "On Hold"].includes(status)) return null;

  const waiting = isWaitingOnAdopter(application);
  const responded = hasNewAdopterResponse(application);
  const blockers = approvalBlockers(checks, CHECK_TYPES);

  const run = async (fn: () => Promise<{ ok: boolean; message?: string; reason?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? (result.reason === "checks_not_passed" ? "All three suitability checks must pass first." : "The action could not be completed. Please reload and try again."));
      return;
    }
    setForm(null);
    setText("");
    await onChanged();
  };
  const review = (action: ReviewAction, message?: string) => run(() => reviewApplication(application.applicationId, action, message));

  const openForm = (f: Form) => {
    setForm(f);
    setText("");
    setError(null);
  };

  return (
    <section aria-labelledby="review-heading" className={card}>
      <h2 id="review-heading" className="text-lg font-bold text-text">
        Application Review
      </h2>

      {application.infoRequestedAt && (
        <div
          role="status"
          className={`mt-3 rounded-[12px] border px-3 py-2 text-sm ${waiting ? "border-gold bg-gold/10" : "border-border bg-page"}`}
        >
          {waiting ? (
            <p className="font-semibold text-text">With Adopter – waiting for documents</p>
          ) : (
            <p className="flex items-center gap-1.5 font-semibold text-text">
              {responded && <span className="inline-block h-2 w-2 rounded-full bg-danger" aria-hidden="true" />}
              New documents uploaded by the Adopter{application.infoRespondedAt ? ` on ${formatDateTime(application.infoRespondedAt)}` : ""}
            </p>
          )}
          <p className="mt-1 text-text-muted">
            Requested by {application.infoRequestedByName} on {formatDateTime(application.infoRequestedAt)}: &ldquo;{application.infoRequestMessage}&rdquo;
          </p>
        </div>
      )}

      {status === "Submitted" && <p className="mt-3 text-sm text-text-muted">This application has not been reviewed yet.</p>}
      {status === "On Hold" && (
        <p className="mt-3 text-sm text-text-muted">
          This application is on hold. It can be resumed once {application.animalName} is available for adoption again.
        </p>
      )}
      {status === "Under Review" && (
        <div className="mt-3 text-sm">
          {blockers.length === 0 ? (
            <p className="text-text">All three suitability checks passed - ready for a decision. The Meet and Greet is scheduled after approval.</p>
          ) : (
            <>
              <p className="font-semibold text-text">Before approving:</p>
              <ul className="list-inside list-disc text-text-muted">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {canAct && (
        <div className="mt-4 flex flex-wrap gap-2">
          {status === "Submitted" && (
            <button type="button" disabled={busy} onClick={() => void review("start")} className={primary}>
              Start Review
            </button>
          )}
          {status === "Under Review" && (
            <button
              type="button"
              disabled={busy || blockers.length > 0}
              title={blockers.length > 0 ? blockers.join(" ") : undefined}
              onClick={() => void run(() => approveApplication(application.applicationId, email, displayName))}
              className={primary}
            >
              Approve
            </button>
          )}
          {status === "On Hold" && (
            <button type="button" disabled={busy} onClick={() => void review("resume")} className={primary}>
              Resume Review
            </button>
          )}
          {(status === "Under Review" || status === "On Hold") && (
            <button type="button" disabled={busy} onClick={() => openForm("reject")} className={`${secondary} border-danger text-danger`}>
              Reject
            </button>
          )}
          {status === "Under Review" && (
            <button type="button" disabled={busy} onClick={() => openForm("hold")} className={secondary}>
              Place On Hold
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => openForm("request_info")} className={secondary}>
            Request more documents / information
          </button>
        </div>
      )}

      {canAct && form && (
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor="review-text" className="text-sm font-semibold text-text">
            {form === "reject"
              ? "Reason for rejecting (shown to the Adopter, required)"
              : form === "hold"
                ? "Note for placing on hold (optional)"
                : "Message to the Adopter (required)"}
          </label>
          <textarea id="review-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} className={textarea} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || (form !== "hold" && !text.trim())}
              onClick={() =>
                void (form === "reject"
                  ? run(() => rejectApplication(application.applicationId, text, email, displayName))
                  : review(form, text))
              }
              className={form === "reject" ? `${primary} bg-danger` : primary}
            >
              {form === "reject" ? "Confirm Reject" : form === "hold" ? "Place On Hold" : "Send Request"}
            </button>
            <button type="button" onClick={() => setForm(null)} className={secondary}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
