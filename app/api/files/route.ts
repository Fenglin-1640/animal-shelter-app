import { NextResponse } from "next/server";
import { ALL_ROLES } from "@/lib/auth/api-roles";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { CHUNK_BYTES, FILE_FORMATS, checkFile, formatFromName, toStoredFileMeta } from "@/lib/files/rules";
import { fail, loadRules, ownerAccess } from "@/lib/files/server";

// Stored files for one owner record (?ownerType=application&ownerId=...):
// metadata only, never the content, and only files whose upload finished.
export async function GET(request: Request) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const params = new URL(request.url).searchParams;
  const ownerType = params.get("ownerType") ?? "";
  const ownerId = params.get("ownerId") ?? "";
  const access = await ownerAccess(auth, ownerType, ownerId);
  if (!access) return fail(404, "not_found");
  if (!access.canRead) return forbidden();
  const rows = await db.orm.StoredFile.where({ ownerType, ownerId }).all();
  return NextResponse.json({ ok: true, items: rows.filter((r) => r.completedAt).map(toStoredFileMeta) });
}

interface StartUpload {
  ownerType?: string;
  ownerId?: string;
  fileName?: string;
  sizeBytes?: number;
}

// Starts an upload: checks the owner, the format and the size against the
// rules in force, and returns the file id and how many chunks to send.
export async function POST(request: Request) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as StartUpload;
  const fileName = body.fileName?.trim() ?? "";
  const sizeBytes = Number(body.sizeBytes);
  const access = await ownerAccess(auth, body.ownerType ?? "", body.ownerId ?? "");
  if (!access) return fail(404, "not_found");
  if (!access.canWrite) return forbidden();
  const rules = await loadRules();
  const problem = !fileName || fileName.length > 200 || !Number.isInteger(sizeBytes) ? "Invalid file." : checkFile(fileName, sizeBytes, rules);
  if (problem) return fail(400, "rejected", { message: problem });

  const format = formatFromName(fileName)!;
  const row = {
    id: `FILE-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    ownerType: body.ownerType!,
    ownerId: body.ownerId!,
    fileName,
    contentType: FILE_FORMATS[format].contentType,
    sizeBytes,
    chunkCount: Math.ceil(sizeBytes / CHUNK_BYTES),
    uploadedByEmail: auth.email,
    uploadedByName: auth.displayName,
    uploadedAt: toTimestamptz(new Date().toISOString()),
    completedAt: null,
  };
  await db.orm.StoredFile.create(row);
  return NextResponse.json({ ok: true, item: toStoredFileMeta(row), chunkBytes: CHUNK_BYTES });
}
