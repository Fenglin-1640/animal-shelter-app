"use client";

import Link from "next/link";
import { useState } from "react";
import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { addPhoto, setPrimaryPhoto } from "@/lib/photos/store";
import type { Photo } from "@/lib/photos/types";
import { fileToDataUrl } from "@/lib/photos/upload";

// The Animal Profile header's avatar/photo box (FR-AN-02's public
// listing photo) - clicking it opens the current photo enlarged in a
// lightbox, with an Edit action (Administrator/Shelter Staff Member
// only, same CAN_ACT_ROLES as the Photos screen) to upload a new photo
// or pick a different existing one as the profile picture. Both paths
// end at the same setPrimaryPhoto() call the Photos screen itself uses,
// so it behaves the same either way (alt text optional).
export function ProfilePhotoLightbox({
  animalId,
  species,
  photos,
  primaryPhoto,
  canEdit,
  email,
  displayName,
  onChanged,
  className,
}: {
  animalId: string;
  species: string;
  photos: Photo[];
  primaryPhoto?: Photo;
  canEdit: boolean;
  email: string;
  displayName: string;
  onChanged: () => void | Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [altTextDraft, setAltTextDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const closeAll = () => {
    setOpen(false);
    setEditing(false);
    setSelectingId(null);
    setPendingFile(null);
    setAltTextDraft("");
    setError(null);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setError(null);
    setUploading(true);
    try {
      const converted = await fileToDataUrl(pendingFile);
      if (!converted.ok) {
        setError(
          converted.reason === "too_large"
            ? "That photo is too large - please choose a file under 8 MB."
            : "That file could not be read as an image.",
        );
        return;
      }
      const uploaded = await addPhoto(
        animalId,
        {
          fileName: pendingFile.name,
          fileSizeKB: Math.max(1, Math.round(pendingFile.size / 1024)),
          dateTaken: new Date().toISOString(),
          imageData: converted.dataUrl,
        },
        email,
        displayName,
      );
      setPendingFile(null);
      await onChanged();
      setSelectingId(uploaded.id);
      setAltTextDraft("");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmPrimary = async (photoId: string) => {
    const result = await setPrimaryPhoto(photoId, altTextDraft);
    if (result.ok) {
      setSelectingId(null);
      setAltTextDraft("");
      setError(null);
      await onChanged();
    } else if (result.reason === "not_found") {
      setError("That photo no longer exists.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block text-left ${className ?? ""}`}
        aria-label={primaryPhoto ? `View ${species} photo, enlarged` : `No photo yet - click to add one`}
      >
        <PlaceholderThumbnail
          species={species}
          altText={primaryPhoto?.altText}
          photoSrc={primaryPhoto?.imageUrl}
          className="w-full sm:w-48"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo"
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[12px] border border-border bg-surface p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text">Profile Photo</h2>
              <button
                type="button"
                onClick={closeAll}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text hover:bg-surface-active"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <PlaceholderThumbnail
              species={species}
              altText={primaryPhoto?.altText}
              photoSrc={primaryPhoto?.imageUrl}
              className="w-full"
            />

            {error && (
              <p role="status" className="text-sm text-danger">
                {error}
              </p>
            )}

            {canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="h-9 w-fit rounded-[12px] border border-border bg-page px-4 text-sm font-semibold text-text hover:bg-surface-active"
              >
                Edit
              </button>
            )}

            {canEdit && editing && (
              <div className="flex flex-col gap-4 rounded-[12px] border border-border bg-page p-4">
                <div>
                  <h3 className="text-sm font-semibold text-text">Upload New Photo</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                      className="text-sm text-text file:mr-2 file:h-9 file:rounded-[12px] file:border file:border-border file:bg-surface file:px-3 file:text-sm file:font-semibold file:text-text"
                    />
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={!pendingFile || uploading}
                      className="h-9 rounded-[12px] border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-active disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>

                {photos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-text">Choose Existing Photo</h3>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => {
                            setSelectingId(photo.id);
                            setAltTextDraft(photo.altText || "");
                            setError(null);
                          }}
                          className={`shrink-0 rounded-[12px] ${
                            photo.id === primaryPhoto?.id ? "ring-2 ring-primary" : ""
                          }`}
                        >
                          <PlaceholderThumbnail species={species} photoSrc={photo.imageUrl} className="w-24" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectingId && (
                  <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface p-3">
                    <label htmlFor="lightbox-alt-text" className="text-xs font-semibold text-text-muted">
                      Alt Text (optional)
                    </label>
                    <input
                      id="lightbox-alt-text"
                      type="text"
                      value={altTextDraft}
                      onChange={(e) => setAltTextDraft(e.target.value)}
                      placeholder="Describe the photo for screen readers"
                      className="h-9 rounded-[12px] border border-border bg-page px-3 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmPrimary(selectingId)}
                        className="h-8 rounded-[12px] bg-primary px-3 text-xs font-semibold text-page hover:opacity-90"
                      >
                        Set as Profile Picture
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectingId(null);
                          setAltTextDraft("");
                        }}
                        className="h-8 rounded-[12px] border border-border bg-page px-3 text-xs font-semibold text-text hover:bg-surface-active"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <Link
                  href={`/animals/${animalId}/photos`}
                  className="text-xs font-semibold text-secondary underline underline-offset-2 hover:no-underline"
                >
                  Manage all photos
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
