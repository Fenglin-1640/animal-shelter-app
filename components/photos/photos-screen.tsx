"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type PointerEventHandler } from "react";
import { AccessDenied } from "@/components/access/access-denied";
import { AppShell } from "@/components/layout/app-shell";
import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { ReadOnlyNoticeModal } from "@/components/shared/read-only-notice-modal";
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
import { fileToDataUrl } from "@/lib/photos/upload";
import type { Role } from "@/lib/roles/roles";
import { formatDate, formatDateTime, todayISO } from "@/lib/shared/dates";
import { DateField } from "@/components/shared/date-field";
import { FileField } from "@/components/shared/file-field";

const ALLOWED_ROLES: Role[] = ["Administrator", "Shelter Staff Member", "Veterinarian"];
const CAN_ACT_ROLES: Role[] = ["Administrator", "Shelter Staff Member"];

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
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
    getAnimalById(animalId).then(async (result) => {
      if (cancelled) return;
      setAnimal(result ?? null);
      if (result) setPhotos(await listPhotosForAnimal(animalId));
    });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dateTaken, setDateTaken] = useState(todayISO());
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [altTextDraft, setAltTextDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const canAct = CAN_ACT_ROLES.includes(role);

  // Mouse-drag-to-scroll for the horizontal photo strip below - wheel
  // scroll works natively once the container is horizontally scrollable
  // with overflow-x, but a plain vertical mouse wheel still scrolls the
  // page instead of the strip unless deltaY is translated into
  // scrollLeft. That translation needs `preventDefault()` on the wheel
  // event, which React's synthetic `onWheel` cannot do (React attaches
  // it as a passive listener) - a native listener via useEffect is
  // required instead.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startScrollLeft: number } | null>(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [photos.length]);

  const handleStripPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    // Don't hijack presses that land on a card's own controls (Set as
    // Public Photo, Remove, the alt-text Confirm/Cancel) - capturing the
    // pointer here retargets the eventual pointerup away from the
    // button, which silently breaks its click in most browsers. Only
    // clicks/drags on the card background (or the strip's own padding)
    // should start a scroll-drag.
    if ((e.target as HTMLElement).closest("button, input, a, label")) return;
    const el = stripRef.current;
    if (!el) return;
    dragState.current = { startX: e.clientX, startScrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  };

  const handleStripPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    const el = stripRef.current;
    if (!el || !dragState.current) return;
    el.scrollLeft = dragState.current.startScrollLeft - (e.clientX - dragState.current.startX);
  };

  const endStripDrag: PointerEventHandler<HTMLDivElement> = (e) => {
    const el = stripRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    dragState.current = null;
  };

  if (animal === undefined) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Loading...
      </div>
    );
  }
  if (!animal) return <NotFound />;

  const refresh = async () => setPhotos(await listPhotosForAnimal(animalId));

  const handleUpload = async () => {
    if (!pendingFile) return;
    setMessage(null);
    setUploading(true);
    try {
      const converted = await fileToDataUrl(pendingFile);
      if (!converted.ok) {
        setMessage(
          converted.reason === "too_large"
            ? "That photo is too large - please choose a file under 8 MB."
            : "That file could not be read as an image.",
        );
        return;
      }
      await addPhoto(
        animalId,
        {
          fileName: pendingFile.name,
          fileSizeKB: Math.max(1, Math.round(pendingFile.size / 1024)),
          dateTaken: fromDateInput(dateTaken),
          imageData: converted.dataUrl,
        },
        email,
        displayName,
      );
      setPendingFile(null);
      setFileInputKey((k) => k + 1);
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmPrimary = async (photoId: string) => {
    const result = await setPrimaryPhoto(photoId, altTextDraft);
    if (result.ok) {
      setSettingPrimaryId(null);
      setAltTextDraft("");
      setMessage(null);
      await refresh();
    } else if (result.reason === "not_found") {
      setMessage("That photo no longer exists.");
    }
  };

  // Shared by "Set as Public Photo" and the public photo's own
  // "Add/Edit Alt Text" - both end at setPrimaryPhoto(), which requires alt
  // text (an intake photo can become the public photo without any).
  const renderAltTextForm = (photoId: string) => (
    <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-page p-3">
      <label htmlFor={`alt-text-${photoId}`} className="text-xs font-semibold text-text-muted">
        Alt Text (optional)
      </label>
      <input
        id={`alt-text-${photoId}`}
        type="text"
        value={altTextDraft}
        onChange={(e) => setAltTextDraft(e.target.value)}
        placeholder="Describe the photo for screen readers"
        className="h-9 rounded-[12px] border border-border bg-surface px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleConfirmPrimary(photoId)}
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
  );

  const handleRemove = async (photoId: string) => {
    const result = await removePhoto(photoId);
    if (result.ok) {
      await refresh();
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
          Exactly one photo can be selected as the public Adoption Listing photo. Alt text is
          optional but helps people using screen readers.
        </p>
        {message && (
          <p role="status" className="mt-2 text-sm text-danger">
            {message}
          </p>
        )}
      </div>

      {!canAct && (
        <ReadOnlyNoticeModal
          storageKey={`photos:${role}`}
          title="Read-only access"
          message="Veterinarian can view Photos but cannot upload or select the public listing photo."
        />
      )}

      {canAct && (
        <section className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
          <h2 className="text-lg font-bold text-text">Upload Photo</h2>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="photo-file" className="text-xs font-semibold text-text-muted">
                Photo File
              </label>
              <FileField
                key={fileInputKey}
                id="photo-file"
                label="Photo File"
                accept="image/*"
                onFile={(file) => setPendingFile(file)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="photo-date-taken" className="text-xs font-semibold text-text-muted">
                Date Taken
              </label>
              <DateField
                id="photo-date-taken"
                value={dateTaken}
                max={todayISO()}
                onChange={(value) => setDateTaken(value)}
                className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!pendingFile || uploading}
              className="h-9 rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload Photo"}
            </button>
          </div>
        </section>
      )}

      {photos.length === 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-text">No photos uploaded yet.</p>
        </div>
      ) : (
        <div
          ref={stripRef}
          onPointerDown={handleStripPointerDown}
          onPointerMove={handleStripPointerMove}
          onPointerUp={endStripDrag}
          onPointerLeave={endStripDrag}
          className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] [cursor:grab] active:[cursor:grabbing]"
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="flex w-56 shrink-0 flex-col gap-2 rounded-[12px] border border-border bg-surface p-3 shadow-[0_2px_8px_rgba(200,182,173,0.2)]"
            >
              <PlaceholderThumbnail
                species={animal.species}
                altText={photo.altText}
                photoSrc={photo.imageUrl}
                className="w-full select-none"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{photo.fileName}</p>
                <p className="text-xs text-text-muted">{formatSize(photo.fileSizeKB)}</p>
                <p className="text-xs text-text-muted">Taken {formatDate(photo.dateTaken)}</p>
                <p className="text-xs text-text-muted">
                  Uploaded by {photo.takenByName} &middot; {formatDateTime(photo.uploadedAt)}
                </p>
              </div>

              {photo.useOnAdoptionListing ? (
                <div className="flex flex-col gap-1">
                  <StatusChip label="Public Listing Photo" category="success" />
                  {photo.altText ? (
                    <p className="text-xs text-text-muted">Alt text: {photo.altText}</p>
                  ) : (
                    <p className="text-xs text-text-muted">No alt text yet (optional).</p>
                  )}
                  {canAct &&
                    (settingPrimaryId === photo.id ? (
                      renderAltTextForm(photo.id)
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setSettingPrimaryId(photo.id);
                            setAltTextDraft(photo.altText);
                            setMessage(null);
                          }}
                          className="h-8 rounded-[12px] border border-border bg-page px-3 text-xs font-semibold text-text hover:bg-surface-active"
                        >
                          {photo.altText ? "Edit Alt Text" : "Add Alt Text"}
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                canAct && (
                  <div className="flex flex-col gap-2">
                    {settingPrimaryId === photo.id ? (
                      renderAltTextForm(photo.id)
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
