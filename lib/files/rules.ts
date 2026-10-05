// Attachment rules shared by the upload screens and the file routes: the
// formats the system can store (PDF, JPG, PNG, up to 5 MB) narrowed by the
// Rule Configuration's allowedAttachmentTypes and maxAttachmentSizeMB.

export const FILE_FORMATS = {
  PDF: { contentType: "application/pdf", extensions: [".pdf"] },
  JPG: { contentType: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  PNG: { contentType: "image/png", extensions: [".png"] },
} as const;
export type FileFormat = keyof typeof FILE_FORMATS;

export const HARD_MAX_MB = 5;
// Each upload/download request carries at most this much file content.
export const CHUNK_BYTES = 2 * 1024 * 1024;

export interface AttachmentRules {
  formats: FileFormat[];
  maxBytes: number;
  maxMB: number;
}

function normaliseFormat(value: string): FileFormat | null {
  const v = value.trim().toUpperCase().replace(/^\./, "");
  if (v === "JPEG") return "JPG";
  return v in FILE_FORMATS ? (v as FileFormat) : null;
}

export function effectiveRules(settings: { allowedAttachmentTypes: string[]; maxAttachmentSizeMB: number } | null | undefined): AttachmentRules {
  const configured = settings?.allowedAttachmentTypes?.map(normaliseFormat).filter((f): f is FileFormat => Boolean(f));
  const formats = configured && configured.length > 0 ? [...new Set(configured)] : (Object.keys(FILE_FORMATS) as FileFormat[]);
  const configuredMB = settings?.maxAttachmentSizeMB && settings.maxAttachmentSizeMB > 0 ? settings.maxAttachmentSizeMB : HARD_MAX_MB;
  const maxMB = Math.min(configuredMB, HARD_MAX_MB);
  return { formats, maxMB, maxBytes: Math.floor(maxMB * 1024 * 1024) };
}

// The format a file name claims, from its extension.
export function formatFromName(fileName: string): FileFormat | null {
  const lower = fileName.toLowerCase();
  for (const [format, info] of Object.entries(FILE_FORMATS) as [FileFormat, (typeof FILE_FORMATS)[FileFormat]][]) {
    if ((info.extensions as readonly string[]).some((ext) => lower.endsWith(ext))) return format;
  }
  return null;
}

// The format the file's first bytes show it really is.
export function sniffFormat(bytes: Uint8Array): FileFormat | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "PDF";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "JPG";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "PNG";
  return null;
}

export function describeRules(rules: AttachmentRules): string {
  return `${rules.formats.join(", ")} up to ${rules.maxMB} MB`;
}

// Null when the file is acceptable, otherwise the message to show.
export function checkFile(fileName: string, sizeBytes: number, rules: AttachmentRules): string | null {
  const format = formatFromName(fileName);
  if (!format || !rules.formats.includes(format)) return `Only ${rules.formats.join(", ")} files can be uploaded.`;
  if (sizeBytes <= 0) return "The file is empty.";
  if (sizeBytes > rules.maxBytes) return `Files must be ${rules.maxMB} MB or smaller.`;
  return null;
}

export interface StoredFileMeta {
  id: string;
  ownerType: string;
  ownerId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  chunkCount: number;
  uploadedByEmail: string;
  uploadedByName: string;
  uploadedAt: string;
  completedAt?: string;
}

export function toStoredFileMeta(row: Omit<StoredFileMeta, "completedAt"> & { completedAt: string | null }): StoredFileMeta {
  return { ...row, completedAt: row.completedAt ?? undefined };
}
