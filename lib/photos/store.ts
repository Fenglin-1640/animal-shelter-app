import type { AnimalPhoto } from "@/lib/animals/types";
import type { Photo } from "@/lib/photos/types";

// FR-AN-02: Photo records, persisted to localStorage since there is no
// backend.
const STORAGE_KEY = "asams-photos";

function loadAll(): Photo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Photo[]) : [];
  } catch {
    return [];
  }
}

function saveAll(photos: Photo[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
}

function generateId(): string {
  return `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function listPhotosForAnimal(animalId: string): Photo[] {
  return loadAll()
    .filter((p) => p.animalId === animalId)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export function getPrimaryPhoto(animalId: string): Photo | undefined {
  return listPhotosForAnimal(animalId).find((p) => p.useOnAdoptionListing);
}

export interface PhotoInput {
  fileName: string;
  fileSizeKB: number;
  dateTaken: string;
}

export function addPhoto(
  animalId: string,
  input: PhotoInput,
  email: string,
  name: string,
  uploadedAt: string = new Date().toISOString(),
): Photo {
  const photo: Photo = {
    id: generateId(),
    animalId,
    ...input,
    takenByEmail: email,
    takenByName: name,
    useOnAdoptionListing: false,
    altText: "",
    uploadedAt,
  };
  saveAll([...loadAll(), photo]);
  return photo;
}

// FR-INT-03's Finalise Intake only captures minimal metadata for its
// "at least one photo uploaded" gate (lib/intake-records). Once the
// Animal is created, those become real Photo records here so FR-AN-02's
// full feature (primary selection, altText) has something to act on.
export function seedPhotosFromIntake(
  animalId: string,
  photos: AnimalPhoto[],
  email: string,
  name: string,
) {
  for (const p of photos) {
    addPhoto(animalId, { fileName: p.fileName, fileSizeKB: p.fileSizeKB, dateTaken: p.uploadedAt }, email, name, p.uploadedAt);
  }
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

export function removePhoto(photoId: string): MutationResult {
  const all = loadAll();
  const photo = all.find((p) => p.id === photoId);
  if (!photo) return { ok: false, reason: "not_found" };
  if (photo.useOnAdoptionListing) {
    return { ok: false, reason: "is_primary" };
  }
  saveAll(all.filter((p) => p.id !== photoId));
  return { ok: true };
}

// PRD: the public photo selection must carry altText.
export function setPrimaryPhoto(
  photoId: string,
  altText: string,
): MutationResult {
  if (!altText.trim()) return { ok: false, reason: "alt_text_required" };

  const all = loadAll();
  const index = all.findIndex((p) => p.id === photoId);
  if (index === -1) return { ok: false, reason: "not_found" };

  const animalId = all[index].animalId;
  for (let i = 0; i < all.length; i++) {
    if (all[i].animalId === animalId && all[i].useOnAdoptionListing) {
      all[i] = { ...all[i], useOnAdoptionListing: false };
    }
  }
  all[index] = { ...all[index], useOnAdoptionListing: true, altText: altText.trim() };
  saveAll(all);
  return { ok: true };
}

export function clearPrimaryPhoto(animalId: string) {
  const all = loadAll();
  saveAll(
    all.map((p) => (p.animalId === animalId && p.useOnAdoptionListing ? { ...p, useOnAdoptionListing: false } : p)),
  );
}
