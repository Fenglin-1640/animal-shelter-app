import { signedPhotoImageUrl } from "@/lib/auth/server-session";
import type { Photo } from "@/lib/photos/types";

export interface PhotoRow extends Omit<Photo, "useOnAdoptionListing" | "uploadedAt" | "imageData"> {
  useOnAdoptionListing: number;
  uploadedAt: string;
  imageData: string | null;
}

// The base64 image itself is left out of every API response so photo
// lists stay small; clients load it from imageUrl, a signed, expiring URL
// served separately with HTTP caching (see signedPhotoImageUrl).
export function toPhoto(row: PhotoRow): Photo {
  const { imageData, ...rest } = row;
  return {
    ...rest,
    useOnAdoptionListing: row.useOnAdoptionListing === 1,
    uploadedAt: row.uploadedAt,
    imageUrl: imageData ? signedPhotoImageUrl(row.id) : undefined,
  };
}

export function toPhotoRowPatch(patch: Partial<Photo>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "useOnAdoptionListing") {
      row[key] = value ? 1 : 0;
    } else {
      row[key] = value;
    }
  }
  return row;
}
