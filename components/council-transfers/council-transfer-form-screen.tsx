"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import {
  createDraft,
  getTransfer,
  submitTransfer,
  updateDraft,
} from "@/lib/council-transfers/store";
import { TRANSFER_STATUS_CATEGORY } from "@/lib/council-transfers/status";
import type { CouncilTransferSubmission, TransferAttachment } from "@/lib/council-transfers/types";
import type { Role } from "@/lib/roles/roles";
import { getActiveValues } from "@/lib/system-administration/store";

const ALLOWED_ROLES: Role[] = ["Council Animal Control Officer"];

interface FieldErrors {
  source?: string;
  arrivalCircumstance?: string;
  foundLocation?: string;
  animalDescription?: string;
  attachments?: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Submission not found.</p>
      <p className="mt-1 text-sm text-text-muted">
        It may not exist, or the link is incorrect.
      </p>
      <Link
        href="/my-transfers"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to My Transfers
      </Link>
    </div>
  );
}

function CouncilTransferFormContent({
  email,
  displayName,
  transferId,
}: {
  email: string;
  displayName: string;
  transferId?: string;
}) {
  const router = useRouter();
  const [existing, setExisting] = useState<CouncilTransferSubmission | null | undefined>(undefined);
  const [dataLoaded, setDataLoaded] = useState(false);
  const notFound = Boolean(transferId) && dataLoaded && !existing;
  const notOwner =
    Boolean(existing) && existing!.submittedByEmail.toLowerCase() !== email.toLowerCase();
  const isReadOnly = existing ? existing.status !== "Draft" : false;

  const [source, setSource] = useState("");
  const [arrivalCircumstance, setArrivalCircumstance] = useState("");
  const [foundLocation, setFoundLocation] = useState("");
  const [animalDescription, setAnimalDescription] = useState("");
  const [attachments, setAttachments] = useState<TransferAttachment[]>([]);
  const [pendingDocType, setPendingDocType] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const sourceRef = useRef<HTMLInputElement>(null);
  const arrivalRef = useRef<HTMLTextAreaElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const [documentTypeOptions, setDocumentTypeOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getActiveValues("Document Type").then((result) => {
      if (!cancelled) setDocumentTypeOptions(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (transferId ? getTransfer(transferId) : Promise.resolve(undefined)).then((record) => {
      if (cancelled) return;
      setExisting(record ?? null);
      setSource(record?.source ?? "");
      setArrivalCircumstance(record?.arrivalCircumstance ?? "");
      setFoundLocation(record?.foundLocation ?? "");
      setAnimalDescription(record?.animalDescription ?? "");
      setAttachments(record?.attachments ?? []);
      setDataLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [transferId]);

  if (!dataLoaded) {
    return <div className="text-sm text-text-muted">Loading...</div>;
  }
  if (notFound) return <NotFound />;
  if (notOwner) return <AccessDenied />;

  if (submittedId) {
    return (
      <div className="mx-auto flex max-w-[440px] flex-col items-center gap-3 rounded-[12px] border border-border bg-surface p-6 text-center shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-surface-active text-primary">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-text">Submission Sent</h1>
        <p className="text-sm text-text-muted">
          Submission ID: <span className="font-mono">{submittedId}</span>
        </p>
        <p className="text-sm text-text">
          Shelter Staff will review this submission. Once submitted, it is
          read-only.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link
            href="/my-transfers"
            className="inline-flex h-9 items-center justify-center rounded-[12px] bg-primary px-4 text-sm font-semibold text-page hover:opacity-90"
          >
            View My Transfers
          </Link>
          <Link
            href="/new-council-transfer"
            className="inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
          >
            Submit Another
          </Link>
        </div>
      </div>
    );
  }

  const buildInput = () => ({
    source,
    arrivalCircumstance,
    foundLocation,
    animalDescription,
    attachments,
  });

  const focusFirstError = (nextErrors: FieldErrors) => {
    if (nextErrors.source) sourceRef.current?.focus();
    else if (nextErrors.arrivalCircumstance) arrivalRef.current?.focus();
    else if (nextErrors.foundLocation) locationRef.current?.focus();
    else if (nextErrors.animalDescription) descriptionRef.current?.focus();
  };

  const handleAddAttachment = () => {
    if (!pendingDocType || !pendingFile) return;
    const attachment: TransferAttachment = {
      id: `ATT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      documentType: pendingDocType,
      fileName: pendingFile.name,
      fileSizeKB: Math.max(1, Math.round(pendingFile.size / 1024)),
      uploadedAt: new Date().toISOString(),
    };
    setAttachments((prev) => [...prev, attachment]);
    setPendingDocType("");
    setPendingFile(null);
    setFileInputKey((k) => k + 1);
    setErrors((prev) => ({ ...prev, attachments: undefined }));
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSaveDraft = async () => {
    setSavedMessage(null);
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (existing) {
      await updateDraft(existing.id, buildInput());
      setIsSaving(false);
      setSavedMessage("Draft saved.");
      return;
    }

    const id = await createDraft(email, displayName, buildInput());
    setIsSaving(false);
    router.push(`/council-transfers/${id}`);
  };

  const handleSubmit = async () => {
    setSavedMessage(null);
    const nextErrors: FieldErrors = {};
    if (!source.trim()) nextErrors.source = "Source is required.";
    if (!arrivalCircumstance.trim()) {
      nextErrors.arrivalCircumstance = "Arrival circumstance is required.";
    }
    if (!foundLocation.trim()) nextErrors.foundLocation = "Found location is required.";
    if (!animalDescription.trim()) {
      nextErrors.animalDescription = "Animal description is required.";
    }
    if (attachments.length === 0) {
      nextErrors.attachments =
        "At least one supporting document is required to submit.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const id = existing ? existing.id : await createDraft(email, displayName, buildInput());
    if (existing) await updateDraft(id, buildInput());
    const result = await submitTransfer(id);
    setIsSaving(false);

    if (!result.ok) {
      setSavedMessage(
        "Something went wrong submitting this transfer. Please try again.",
      );
      return;
    }

    setSubmittedId(id);
  };

  const errorEntries = Object.entries(errors).filter(
    (entry): entry is [keyof FieldErrors, string] => Boolean(entry[1]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/my-transfers"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to My Transfers
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">
            {existing ? "Council Transfer Submission" : "New Council Transfer"}
          </h1>
          {existing && (
            <StatusChip
              label={existing.status}
              category={TRANSFER_STATUS_CATEGORY[existing.status]}
            />
          )}
        </div>
        {existing && (
          <p className="mt-1 text-sm text-text-muted">
            {existing.id}
            {existing.submissionDate ? ` · Submitted ${formatDateTime(existing.submissionDate)}` : ""}
          </p>
        )}
        {isReadOnly && (
          <p className="mt-2 text-sm text-text">
            This submission has been sent and is read-only.
          </p>
        )}
      </div>

      {errorEntries.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex gap-2 rounded-[12px] border border-danger bg-danger/10 px-3 py-3 text-sm text-text"
        >
          <AlertIcon />
          <ul className="flex flex-col gap-1">
            {errorEntries.map(([, message]) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Transfer Details</h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="source" className="text-sm font-semibold text-text">
              Source <span aria-hidden="true">*</span>
            </label>
            <input
              ref={sourceRef}
              id="source"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={isReadOnly}
              placeholder="e.g. Ranger patrol seizure, public report to council"
              aria-invalid={Boolean(errors.source)}
              className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 ${errors.source ? "border-danger" : "border-border"}`}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="arrivalCircumstance" className="text-sm font-semibold text-text">
              Arrival Circumstance <span aria-hidden="true">*</span>
            </label>
            <textarea
              ref={arrivalRef}
              id="arrivalCircumstance"
              rows={2}
              value={arrivalCircumstance}
              onChange={(e) => setArrivalCircumstance(e.target.value)}
              disabled={isReadOnly}
              aria-invalid={Boolean(errors.arrivalCircumstance)}
              className={`rounded-[12px] border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 ${errors.arrivalCircumstance ? "border-danger" : "border-border"}`}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="foundLocation" className="text-sm font-semibold text-text">
              Found Location <span aria-hidden="true">*</span>
            </label>
            <input
              ref={locationRef}
              id="foundLocation"
              type="text"
              value={foundLocation}
              onChange={(e) => setFoundLocation(e.target.value)}
              disabled={isReadOnly}
              aria-invalid={Boolean(errors.foundLocation)}
              className={`h-10 rounded-[12px] border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 ${errors.foundLocation ? "border-danger" : "border-border"}`}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="animalDescription" className="text-sm font-semibold text-text">
              Animal Description <span aria-hidden="true">*</span>
            </label>
            <textarea
              ref={descriptionRef}
              id="animalDescription"
              rows={3}
              value={animalDescription}
              onChange={(e) => setAnimalDescription(e.target.value)}
              disabled={isReadOnly}
              placeholder="Preliminary description: species, approximate breed, colour, temperament observed"
              aria-invalid={Boolean(errors.animalDescription)}
              className={`rounded-[12px] border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 ${errors.animalDescription ? "border-danger" : "border-border"}`}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">
          Supporting Documents <span aria-hidden="true">*</span>
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Attach the seizure notice, complaint history, found-animal report
          or other council paperwork. Only the file name and type are
          recorded; file content is not stored.
        </p>

        {attachments.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-page px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-semibold text-text">{a.documentType}</span>
                  <span className="text-text-muted"> — {a.fileName} ({formatSize(a.fileSizeKB)})</span>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(a.id)}
                    className="text-xs font-semibold text-danger underline underline-offset-2 hover:no-underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!isReadOnly && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="pendingDocType" className="text-xs font-semibold text-text-muted">
                Document Type
              </label>
              <select
                id="pendingDocType"
                value={pendingDocType}
                onChange={(e) => setPendingDocType(e.target.value)}
                className="h-9 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <option value="">Select</option>
                {documentTypeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pendingFile" className="text-xs font-semibold text-text-muted">
                File
              </label>
              <input
                key={fileInputKey}
                id="pendingFile"
                type="file"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                className="text-sm text-text file:mr-2 file:h-9 file:rounded-[12px] file:border file:border-border file:bg-page file:px-3 file:text-sm file:font-semibold file:text-text"
              />
            </div>
            <button
              type="button"
              onClick={handleAddAttachment}
              disabled={!pendingDocType || !pendingFile}
              className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add Attachment
            </button>
          </div>
        )}
      </section>

      {!isReadOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Submitting..." : "Submit"}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="h-10 rounded-[12px] border border-border bg-surface px-5 text-sm font-semibold text-text hover:bg-surface-active disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save as Draft"}
          </button>
          {savedMessage && (
            <span role="status" className="text-sm text-text">
              {savedMessage}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function CouncilTransferFormScreen() {
  const { user } = useAuth();
  const params = useParams<{ id?: string }>();
  const transferId = params.id;
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
      <CouncilTransferFormContent
        email={user.email}
        displayName={user.displayName}
        transferId={transferId}
      />
    </AppShell>
  );
}
