// FR-AN-02. fileName/fileSizeKB still mirror the metadata-only pattern
// used for Council Transfer/Intake Record attachments, but unlike
// those, Photo also carries the real image bytes (imageData below) -
// this is the one attachment kind the PRD requires actually rendering
// back to the user (public listing photo, profile picture), not just
// listing as a filename.
export interface Photo {
  id: string;
  animalId: string;
  fileName: string;
  fileSizeKB: number;
  dateTaken: string;
  takenByEmail: string;
  takenByName: string;
  // PRD: "同一动物至少有一张、最多一张照片可被标记为主要公开图片" - at most one
  // photo per animal may have this set; setPrimaryPhoto() enforces it.
  useOnAdoptionListing: boolean;
  altText: string;
  uploadedAt: string;
  // The actual uploaded image, as a base64 data URL (downscaled
  // client-side before upload - see lib/photos/upload.ts). No real
  // filesystem storage is used since this app deploys to Vercel, which
  // has no writable/persistent filesystem. Only ever sent on upload -
  // API responses never include it (see imageUrl).
  imageData?: string;
  // Where to load the image from (GET /api/photos/:id/image), set by the
  // API whenever the row has image data. Undefined for rows uploaded
  // without an image.
  imageUrl?: string;
}
