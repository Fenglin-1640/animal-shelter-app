import type { Photo } from "@/lib/photos/types";
import { getJson, send } from "@/lib/shared/http";

// FR-AN-02: Photo now lives in the database (see prisma/contract.prisma)
// behind /api/photos - see prisma/README.md for this Prisma toolchain's
// quirks.

// Photo responses carry metadata plus imageUrl only (never the image
// itself), so the full list stays small.
async function fetchAll(animalId?: string): Promise<Photo[]> {
  const result = await getJson(animalId ? `/api/photos?animalId=${encodeURIComponent(animalId)}` : "/api/photos");
  return result.items as Photo[];
}

function newestFirst(photos: Photo[]): Photo[] {
  return photos.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

async function patchPhoto(photoId: string, patch: Partial<Photo>): Promise<Photo | undefined> {
  const response = await send(`/api/photos/${photoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const result = await response.json();
  if (!result.ok) return undefined;
  return result.item as Photo;
}

function generateId(): string {
  return `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function listPhotosForAnimal(animalId: string): Promise<Photo[]> {
  return newestFirst(await fetchAll(animalId));
}

// Reads the shared all-animals list rather than ?animalId=, so a screen
// rendering many thumbnails at once (Animals, Adoption Listings, card
// lists) shares one request instead of issuing one per animal.
export async function getPrimaryPhoto(animalId: string): Promise<Photo | undefined> {
  return newestFirst((await fetchAll()).filter((p) => p.animalId === animalId)).find((p) => p.useOnAdoptionListing);
}

export interface PhotoInput {
  fileName: string;
  fileSizeKB: number;
  dateTaken: string;
  imageData?: string;
  altText?: string;
}

export async function addPhoto(
  animalId: string,
  input: PhotoInput,
  email: string,
  name: string,
  uploadedAt: string = new Date().toISOString(),
): Promise<Photo> {
  const photo: Photo = {
    id: generateId(),
    animalId,
    ...input,
    takenByEmail: email,
    takenByName: name,
    useOnAdoptionListing: false,
    altText: input.altText?.trim() ?? "",
    uploadedAt,
  };
  await send("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(photo),
  });
  return photo;
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

export async function removePhoto(photoId: string): Promise<MutationResult> {
  const all = await fetchAll();
  const photo = all.find((p) => p.id === photoId);
  if (!photo) return { ok: false, reason: "not_found" };
  if (photo.useOnAdoptionListing) {
    return { ok: false, reason: "is_primary" };
  }
  const deleteResponse = await send(`/api/photos/${photoId}`, { method: "DELETE" });
  const result = await deleteResponse.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };
  return { ok: true };
}

// Selects the public Adoption Listing photo. Alt text is optional.
export async function setPrimaryPhoto(
  photoId: string,
  altText: string,
): Promise<MutationResult> {
  const all = await fetchAll();
  const target = all.find((p) => p.id === photoId);
  if (!target) return { ok: false, reason: "not_found" };

  for (const p of all) {
    if (p.animalId === target.animalId && p.useOnAdoptionListing && p.id !== photoId) {
      await patchPhoto(p.id, { useOnAdoptionListing: false });
    }
  }
  const updated = await patchPhoto(photoId, { useOnAdoptionListing: true, altText: altText.trim() });
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true };
}

export async function clearPrimaryPhoto(animalId: string): Promise<void> {
  const all = await fetchAll();
  for (const p of all) {
    if (p.animalId === animalId && p.useOnAdoptionListing) {
      await patchPhoto(p.id, { useOnAdoptionListing: false });
    }
  }
}
