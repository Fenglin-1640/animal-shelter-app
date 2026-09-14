"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { listAllTransfers } from "@/lib/council-transfers/store";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import {
  createIntakeRecord,
  finaliseIntake,
  getIntakeRecord,
  listLinkedTransferIds,
  updateIntakeRecord,
} from "@/lib/intake-records/store";
import { INTAKE_COMPLETENESS_CATEGORY } from "@/lib/intake-records/status";
import {
  getFinaliseBlockers,
  isIntakeRecordComplete,
  type IntakeRecordFormInput,
} from "@/lib/intake-records/types";
import type { AnimalPhoto, Sex, Species } from "@/lib/animals/types";
import type { Role } from "@/lib/roles/roles";
import { getActiveValues } from "@/lib/system-administration/store";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];
const SPECIES_OPTIONS: Species[] = ["Cat", "Dog", "Bird", "Reptile"];
const SEX_OPTIONS: Sex[] = ["Male", "Female"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function LoadingBlock() {
  return <div className="text-sm text-text-muted">Loading...</div>;
}

function IntakeRecordFormInner() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ intakeId?: string }>();
  const searchParams = useSearchParams();
  const intakeId = params.intakeId;
  const prefillTransferId = searchParams.get("transferId");

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
      <IntakeRecordFormContent
        email={user.email}
        displayName={user.displayName}
        intakeId={intakeId}
        prefillTransferId={prefillTransferId ?? undefined}
        onCreated={(id) => router.push(`/intake-records/${id}`)}
      />
    </AppShell>
  );
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Intake record not found.</p>
      <Link
        href="/animal-intake"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Animal Intake
      </Link>
    </div>
  );
}

function IntakeRecordFormContent({
  email,
  displayName,
  intakeId,
  prefillTransferId,
  onCreated,
}: {
  email: string;
  displayName: string;
  intakeId?: string;
  prefillTransferId?: string;
  onCreated: (id: string) => void;
}) {
  const [existing] = useState(() => (intakeId ? getIntakeRecord(intakeId) : undefined));
  const notFound = Boolean(intakeId) && !existing;
  const [finalisedAt, setFinalisedAt] = useState(existing?.finalisedAt);
  const isReadOnly = Boolean(finalisedAt);

  const intakeSourceOptions = getActiveValues("Intake Source");
  const allTransfers = listAllTransfers();
  const linkedElsewhere = listLinkedTransferIds(intakeId);
  const eligibleTransfers = allTransfers.filter(
    (t) =>
      !linkedElsewhere.has(t.id) &&
      (t.status === "Submitted" || t.id === existing?.councilTransferSubmissionId),
  );

  const initialTransferId = existing?.councilTransferSubmissionId ?? prefillTransferId ?? "";
  const prefillTransfer = allTransfers.find((t) => t.id === initialTransferId);

  const [animalName, setAnimalName] = useState(existing?.animalName ?? "");
  const [arrivalCircumstance, setArrivalCircumstance] = useState(
    existing?.arrivalCircumstance ?? prefillTransfer?.arrivalCircumstance ?? "",
  );
  const [arrivalDateTime, setArrivalDateTime] = useState(
    existing ? toDatetimeLocalValue(existing.arrivalDateTime) : toDatetimeLocalValue(new Date().toISOString()),
  );
  const [intakeSource, setIntakeSource] = useState(
    existing?.intakeSource ?? (prefillTransfer ? "Council Transfer" : ""),
  );
  const [surrenderingPartyName, setSurrenderingPartyName] = useState(
    existing?.surrenderingPartyName ?? "",
  );
  const [councilTransferSubmissionId, setCouncilTransferSubmissionId] = useState(
    initialTransferId,
  );
  const [species, setSpecies] = useState<Species | "">(existing?.species ?? "");
  const [hasKnownDob, setHasKnownDob] = useState(Boolean(existing?.dateOfBirth));
  const [dateOfBirth, setDateOfBirth] = useState(existing?.dateOfBirth ?? "");
  const [estimatedAge, setEstimatedAge] = useState(existing?.estimatedAge ?? "");
  const [sex, setSex] = useState<Sex | "">(existing?.sex ?? "");
  const [coatColour, setCoatColour] = useState(existing?.coatColour ?? "");
  const [coatMarkings, setCoatMarkings] = useState(existing?.coatMarkings ?? "");
  const [photos, setPhotos] = useState<AnimalPhoto[]>(existing?.photos ?? []);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isFinalising, setIsFinalising] = useState(false);

  if (notFound) return <NotFound />;

  const isCouncilSource = intakeSource === "Council Transfer";
  const linkedTransfer: CouncilTransferSubmission | undefined = isCouncilSource
    ? allTransfers.find((t) => t.id === councilTransferSubmissionId)
    : undefined;

  const buildInput = (): IntakeRecordFormInput => ({
    animalName,
    arrivalCircumstance,
    arrivalDateTime: fromDatetimeLocalValue(arrivalDateTime),
    intakeSource,
    surrenderingPartyName: isCouncilSource ? "" : surrenderingPartyName,
    councilTransferSubmissionId: isCouncilSource ? councilTransferSubmissionId || undefined : undefined,
    species,
    estimatedAge: hasKnownDob ? "" : estimatedAge,
    dateOfBirth: hasKnownDob ? dateOfBirth : "",
    sex,
    coatColour,
    coatMarkings,
    photos,
  });

  const complete = isIntakeRecordComplete(buildInput());
  const liveBlockers = getFinaliseBlockers(buildInput(), linkedTransfer);

  const handleAddPhoto = () => {
    if (!pendingPhotoFile) return;
    const photo: AnimalPhoto = {
      id: `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      fileName: pendingPhotoFile.name,
      fileSizeKB: Math.max(1, Math.round(pendingPhotoFile.size / 1024)),
      uploadedAt: new Date().toISOString(),
    };
    setPhotos((prev) => [...prev, photo]);
    setPendingPhotoFile(null);
    setPhotoInputKey((k) => k + 1);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    setSavedMessage(null);
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const input = buildInput();
    if (existing) {
      updateIntakeRecord(existing.intakeId, input);
      setIsSaving(false);
      setSavedMessage("Intake record saved.");
      return;
    }

    const id = createIntakeRecord(email, displayName, input);
    setIsSaving(false);
    onCreated(id);
  };

  const handleFinalise = async () => {
    if (!existing) return;
    setSavedMessage(null);
    setIsFinalising(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Persist the latest edits first so Finalise checks against current data.
    updateIntakeRecord(existing.intakeId, buildInput());
    const result = finaliseIntake(existing.intakeId, email, displayName);
    setIsFinalising(false);

    if (!result.ok) {
      // The Finalise button is disabled whenever liveBlockers is non-empty,
      // so "blocked" here would only happen from a stale read - defensive,
      // not expected in normal use.
      setSavedMessage(
        result.reason === "blocked"
          ? (result.blockers?.[0] ?? "Some required items are still missing.")
          : "Something went wrong finalising this intake. Please try again.",
      );
      return;
    }

    const refreshed = getIntakeRecord(existing.intakeId);
    setFinalisedAt(refreshed?.finalisedAt);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/animal-intake"
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to Animal Intake
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-text">
            {existing ? "Intake Record" : "New Intake Record"}
          </h1>
          <StatusChip
            label={isReadOnly ? "Finalised" : complete ? "Complete" : "Incomplete"}
            category={
              isReadOnly
                ? "complete"
                : INTAKE_COMPLETENESS_CATEGORY[complete ? "Complete" : "Incomplete"]
            }
          />
        </div>
        {existing && (
          <p className="mt-1 text-sm text-text-muted">
            {existing.intakeId} &middot; Animal ID {existing.animalId} &middot; Created{" "}
            {formatDateTime(existing.createdAt)}
          </p>
        )}
        {isReadOnly ? (
          <p className="mt-2 text-sm text-text">
            This intake has been finalised into an Animal Profile and is
            read-only.{" "}
            <Link
              href={`/animals/${existing?.animalId}`}
              className="font-semibold text-secondary underline underline-offset-2 hover:no-underline"
            >
              View Animal Profile
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            All fields can be saved incrementally. Finalising intake creates
            the Animal Profile and cannot be undone.
          </p>
        )}
      </div>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Arrival</h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1 sm:max-w-xs">
            <label htmlFor="animalName" className="text-sm font-semibold text-text">
              Animal Name
            </label>
            <input
              id="animalName"
              type="text"
              value={animalName}
              onChange={(e) => setAnimalName(e.target.value)}
              disabled={isReadOnly}
              className="h-10 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="arrivalCircumstance" className="text-sm font-semibold text-text">
              Arrival Circumstance
            </label>
            <textarea
              id="arrivalCircumstance"
              rows={2}
              value={arrivalCircumstance}
              onChange={(e) => setArrivalCircumstance(e.target.value)}
              disabled={isReadOnly}
              className="rounded-[12px] border border-border bg-page px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="arrivalDateTime" className="text-sm font-semibold text-text">
                Arrival Date and Time
              </label>
              <input
                id="arrivalDateTime"
                type="datetime-local"
                value={arrivalDateTime}
                onChange={(e) => setArrivalDateTime(e.target.value)}
                disabled={isReadOnly}
                className="h-10 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="intakeSource" className="text-sm font-semibold text-text">
                Intake Source
              </label>
              <select
                id="intakeSource"
                value={intakeSource}
                onChange={(e) => {
                  setIntakeSource(e.target.value);
                  if (e.target.value !== "Council Transfer") setCouncilTransferSubmissionId("");
                }}
                disabled={isReadOnly}
                className="h-10 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              >
                <option value="">Select</option>
                {intakeSourceOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {isCouncilSource ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="councilTransfer" className="text-sm font-semibold text-text">
                Council Transfer Reference
              </label>
              <select
                id="councilTransfer"
                value={councilTransferSubmissionId}
                onChange={(e) => setCouncilTransferSubmissionId(e.target.value)}
                disabled={isReadOnly}
                className="h-10 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              >
                <option value="">Select</option>
                {eligibleTransfers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.foundLocation} ({t.submittedByName})
                  </option>
                ))}
              </select>
              {linkedTransfer && (
                <p className="mt-1 rounded-[12px] border border-border bg-page p-3 text-sm text-text-muted">
                  {linkedTransfer.animalDescription} &middot; {linkedTransfer.attachments.length}{" "}
                  supporting document{linkedTransfer.attachments.length === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="surrenderingPartyName" className="text-sm font-semibold text-text">
                Surrendering Party Name
              </label>
              <input
                id="surrenderingPartyName"
                type="text"
                value={surrenderingPartyName}
                onChange={(e) => setSurrenderingPartyName(e.target.value)}
                disabled={isReadOnly}
                className="h-10 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">Animal Details</h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="species" className="text-sm font-semibold text-text">
                Species
              </label>
              <select
                id="species"
                value={species}
                onChange={(e) => setSpecies(e.target.value as Species)}
                disabled={isReadOnly}
                className="h-10 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              >
                <option value="">Select</option>
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="sex" className="text-sm font-semibold text-text">
                Sex
              </label>
              <select
                id="sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}
                disabled={isReadOnly}
                className="h-10 rounded-[12px] border border-border bg-page px-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              >
                <option value="">Select</option>
                {SEX_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={hasKnownDob}
                onChange={(e) => setHasKnownDob(e.target.checked)}
                disabled={isReadOnly}
                className="h-4 w-4 rounded border-border text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              />
              Date of birth is known
            </label>
            {hasKnownDob ? (
              <div className="flex flex-col gap-1 sm:max-w-xs">
                <label htmlFor="dateOfBirth" className="text-sm font-semibold text-text">
                  Date of Birth
                </label>
                <input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={isReadOnly}
                  className="h-10 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1 sm:max-w-xs">
                <label htmlFor="estimatedAge" className="text-sm font-semibold text-text">
                  Estimated Age
                </label>
                <input
                  id="estimatedAge"
                  type="text"
                  placeholder="e.g. Approx. 2 years"
                  value={estimatedAge}
                  onChange={(e) => setEstimatedAge(e.target.value)}
                  disabled={isReadOnly}
                  className="h-10 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="coatColour" className="text-sm font-semibold text-text">
                Coat Colour
              </label>
              <input
                id="coatColour"
                type="text"
                value={coatColour}
                onChange={(e) => setCoatColour(e.target.value)}
                disabled={isReadOnly}
                className="h-10 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="coatMarkings" className="text-sm font-semibold text-text">
                Coat Markings
              </label>
              <input
                id="coatMarkings"
                type="text"
                value={coatMarkings}
                onChange={(e) => setCoatMarkings(e.target.value)}
                disabled={isReadOnly}
                className="h-10 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
        <h2 className="text-lg font-bold text-text">
          Photos <span aria-hidden="true">*</span>
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          At least one photo is required before Finalise Intake. This
          prototype records the file name only; file content is not stored.
        </p>

        {photos.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {photos.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-page px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-semibold text-text">{p.fileName}</span>
                  <span className="text-text-muted"> ({formatSize(p.fileSizeKB)})</span>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(p.id)}
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
              <label htmlFor="pendingPhoto" className="text-xs font-semibold text-text-muted">
                Photo File
              </label>
              <input
                key={photoInputKey}
                id="pendingPhoto"
                type="file"
                accept="image/*"
                onChange={(e) => setPendingPhotoFile(e.target.files?.[0] ?? null)}
                className="text-sm text-text file:mr-2 file:h-9 file:rounded-[12px] file:border file:border-border file:bg-page file:px-3 file:text-sm file:font-semibold file:text-text"
              />
            </div>
            <button
              type="button"
              onClick={handleAddPhoto}
              disabled={!pendingPhotoFile}
              className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add Photo
            </button>
          </div>
        )}
      </section>

      {!isReadOnly && (
        <div className="flex flex-col gap-3">
          {liveBlockers.length > 0 && (
            <div
              role="status"
              className="flex flex-col gap-1 rounded-[12px] border border-gold bg-gold/10 px-3 py-3 text-sm text-text"
            >
              <p className="font-semibold">Not ready to finalise:</p>
              <ul className="list-inside list-disc">
                {liveBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isFinalising}
              className="h-10 rounded-[12px] border border-border bg-surface px-5 text-sm font-semibold text-text hover:bg-surface-active disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Intake Record"}
            </button>
            <button
              type="button"
              onClick={handleFinalise}
              disabled={!existing || isSaving || isFinalising || liveBlockers.length > 0}
              title={
                !existing
                  ? "Save the intake record before finalising"
                  : liveBlockers.length > 0
                    ? "Resolve the items listed above before finalising"
                    : undefined
              }
              className="h-10 rounded-[12px] bg-primary px-5 text-sm font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFinalising ? "Finalising..." : "Finalise Intake"}
            </button>
            {savedMessage && (
              <span role="status" className="text-sm text-text">
                {savedMessage}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IntakeRecordFormScreen() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <IntakeRecordFormInner />
    </Suspense>
  );
}
