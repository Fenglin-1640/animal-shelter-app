import type { Photo } from "@/lib/photos/types";

export interface PhotoRow extends Omit<Photo, "useOnAdoptionListing" | "uploadedAt" | "imageData"> {
  useOnAdoptionListing: number;
  uploadedAt: Date;
  imageData: string | null;
}

export function toPhoto(row: PhotoRow): Photo {
  return {
    ...row,
    useOnAdoptionListing: row.useOnAdoptionListing === 1,
    uploadedAt: row.uploadedAt.toISOString(),
    imageData: row.imageData ?? undefined,
  };
}

export function toPhotoRowPatch(patch: Partial<Photo>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "useOnAdoptionListing") {
      row[key] = value ? 1 : 0;
    } else if (key === "uploadedAt") {
      row[key] = typeof value === "string" ? new Date(value) : value;
    } else {
      row[key] = value;
    }
  }
  return row;
}
