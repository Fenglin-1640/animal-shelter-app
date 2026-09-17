"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { StatusChip } from "@/components/shared/status-chip";
import { useAuth } from "@/lib/auth/auth-context";
import { getAnimalById } from "@/lib/animals/animal-store";
import type { Animal } from "@/lib/animals/types";
import {
  addPhoto,
  listPhotosForAnimal,
  removePhoto,
  setPrimaryPhoto,
} from "@/lib/photos/store";
import type { Photo } from "@/lib/photos/types";
import type { Role } from "@/lib/roles/roles";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
const CAN_ACT_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function NotFound() {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-text">Animal not found.</p>
      <Link
        href="/animals"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
      >
        Back to Animals
      </Link>
    </div>
  );
}

function PhotosContent({
  animalId,
  email,
  displayName,
  role,
}: {
  animalId: string;
  email: string;
  displayName: string;
  role: Role;
}) {
  const [animal, setAnimal] = useState<Animal | null | undefined>(undefined);
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAnimalById(animalId).then((result) => {
      if (cancelled) return;
      setAnimal(result ?? null);
      if (result) setPhotos(listPhotosForAnimal(animalId));
    });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dateTaken, setDateTaken] = useState(todayDate());
  const [fileInputKey, setFileInputKey] = useState(0);

  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [altTextDraft, setAltTextDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const canAct = CAN_ACT_ROLES.includes(role);

  if (animal === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!animal) return <NotFound />;

  const refresh = () => setPhotos(listPhotosForAnimal(animalId));

  const handleUpload = () => {
    if (!pendingFile) return;
    addPhoto(
      animalId,
      {
        fileName: pendingFile.name,
        fileSizeKB: Math.max(1, Math.round(pendingFile.size / 1024)),
        dateTaken: fromDateInput(dateTaken),
      },
      email,
      displayName,
    );
    setPendingFile(null);
    setFileInputKey((k) => k + 1);
    refresh();
  };

  const handleConfirmPrimary = (photoId: string) => {
    const result = setPrimaryPhoto(photoId, altTextDraft);
    if (result.ok) {
      setSettingPrimaryId(null);
      setAltTextDraft("");
      setMessage(null);
      refresh();
    } else if (result.reason === "alt_text_required") {
      setMessage("Alt text is required to select a public photo.");
    }
  };

  const handleRemove = (photoId: string) => {
    const result = removePhoto(photoId);
    if (result.ok) {
      refresh();
    } else if (result.reason === "is_primary") {
      setMessage("This is the public listing photo - select a different one first, or unpublish this animal.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/animals/${animalId}`}
          className="text-sm font-semibold text-secondary underline underline-offset-2 hover:no-underline"
        >
          &larr; Back to {animal.name}&apos;s Profile
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text">Photos</h1>
        <p className="mt-1 text-sm text-text-muted">
          {animal.name} &middot; {animal.shelterId}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Photo metadata only is stored in this prototype (file name, size, date taken) - no file
          content is uploaded to a server, matching the same pattern used for Council Transfer and
          Intake Record attachments. Exactly one photo can be selected as the public Adoption
          Listing photo, and it requires alt text.
        </p>
        {!canAct && (
          <p className="mt-2 text-sm text-text-muted">
            Veterinarian can view Photos but cannot upload or select the public listing photo.
          </p>
        )}
        {message && (
          <p role="status" className="mt-2 text-sm text-danger">
            {message}
          </p>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">No photos uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)]"
            >
              <div className="flex items-center gap-3">
                <PlaceholderThumbnail species={animal.species} className="w-20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{photo.fileName}</p>
                  <p className="text-xs text-text-muted">{formatSize(photo.fileSizeKB)}</p>
                  <p className="text-xs text-text-muted">Taken {formatDate(photo.dateTaken)}</p>
                  <p className="text-xs text-text-muted">
                    Uploaded by {photo.takenByName} &middot; {formatDateTime(photo.uploadedAt)}
                  </p>
                </div>
              </div>

              {photo.useOnAdoptionListing ? (
                <div className="flex flex-col gap-1">
                  <StatusChip label="Public Listing Photo" category="success" />
                  <p className="text-xs text-text-muted">Alt text: {photo.altText}</p>
                </div>
              ) : (
                canAct && (
                  <div className="flex flex-col gap-2">
                    {settingPrimaryId === photo.id ? (
                      <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-page p-3">
                        <label
                          htmlFor={`alt-text-${photo.id}`}
                          className="text-xs font-semibold text-text-muted"
                        >
                          Alt Text (required)
                        </label>
                        <input
                          id={`alt-text-${photo.id}`}
                          type="text"
                          value={altTextDraft}
                          onChange={(e) => setAltTextDraft(e.target.value)}
                          placeholder="Describe the photo for screen readers"
                          className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirmPrimary(photo.id)}
                            className="h-8 rounded-[12px] bg-primary px-3 text-xs font-semibold text-page hover:opacity-90"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSettingPrimaryId(null);
                              setAltTextDraft("");
                            }}
                            className="h-8 rounded-[12px] border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-active"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSettingPrimaryId(photo.id);
                            setAltTextDraft("");
                            setMessage(null);
                          }}
                          className="h-8 rounded-[12px] border border-border bg-page px-3 text-xs font-semibold text-text hover:bg-surface-active"
                        >
                          Set as Public Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(photo.id)}
                          className="h-8 rounded-[12px] border border-border bg-page px-3 text-xs font-semibold text-danger hover:bg-surface-active"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {canAct && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Upload Photo</h2>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="photo-file" className="text-xs font-semibold text-text-muted">
                Photo File
              </label>
              <input
                key={fileInputKey}
                id="photo-file"
                type="file"
                accept="image/*"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                className="text-sm text-text file:mr-2 file:h-9 file:rounded-[12px] file:border file:border-border file:bg-page file:px-3 file:text-sm file:font-semibold file:text-text"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="photo-date-taken" className="text-xs font-semibold text-text-muted">
                Date Taken
              </label>
              <input
                id="photo-date-taken"
                type="date"
                value={dateTaken}
                max={todayDate()}
                onChange={(e) => setDateTaken(e.target.value)}
                className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!pendingFile}
              className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
            >
              Upload Photo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function fromDateInput(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function PhotosScreen() {
  const { user } = useAuth();
  const params = useParams<{ animalId: string }>();
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
      <PhotosContent
        animalId={params.animalId}
        email={user.email}
        displayName={user.displayName}
        role={user.role}
      />
    </AppShell>
  );
}
