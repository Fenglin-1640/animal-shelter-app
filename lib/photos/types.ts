// FR-AN-02. Metadata only - no real file storage backend in this
// prototype, the same pattern already used for Council Transfer and
// Intake Record attachments: `file` is represented by fileName +
// fileSizeKB, not real bytes.
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
}
