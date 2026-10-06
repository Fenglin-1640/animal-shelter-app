import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { ALL_ROLES, isOwnRecord } from "@/lib/auth/api-roles";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { CHUNK_BYTES, formatFromName, sniffFormat } from "@/lib/files/rules";
import { fail, ownerAccess } from "@/lib/files/server";
import type { ApplicationDocument } from "@/lib/applications/types";

type Params = { params: Promise<{ id: string; index: string }> };

function expectedLength(sizeBytes: number, chunkCount: number, index: number): number {
  return index < chunkCount - 1 ? CHUNK_BYTES : sizeBytes - CHUNK_BYTES * (chunkCount - 1);
}

// Protected download: one chunk of a finished file, for anyone who may
// read its owner record. Never cached.
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const { id, index } = await params;
  const file = await db.orm.StoredFile.where({ id }).first();
  if (!file?.completedAt) return fail(404, "not_found");
  const access = await ownerAccess(auth, file.ownerType, file.ownerId);
  if (!access?.canRead) return forbidden();
  const chunk = await db.orm.StoredFileChunk.where({ id: `${id}:${Number(index)}` }).first();
  if (!chunk) return fail(404, "not_found");
  return new Response(Buffer.from(chunk.data, "base64"), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" },
  });
}

// Upload: one chunk of raw bytes, from the user who started the upload.
// The first chunk must really be the declared format and every chunk must
// be exactly the expected length. When the last chunk arrives the file is
// marked complete, listed on the application and audited, all in one
// transaction.
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const { id, index: rawIndex } = await params;
  const index = Number(rawIndex);
  const file = await db.orm.StoredFile.where({ id }).first();
  if (!file || file.completedAt) return fail(404, "not_found");
  if (!isOwnRecord(auth, file.uploadedByEmail)) return forbidden();
  const access = await ownerAccess(auth, file.ownerType, file.ownerId);
  if (!access?.canWrite) return forbidden();
  if (!Number.isInteger(index) || index < 0 || index >= file.chunkCount) return fail(400, "invalid_chunk");
  if (Number(request.headers.get("content-length") ?? 0) > CHUNK_BYTES) return fail(413, "too_large");

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length !== expectedLength(file.sizeBytes, file.chunkCount, index)) return fail(400, "invalid_chunk");
  if (index === 0 && sniffFormat(bytes) !== formatFromName(file.fileName)) {
    // Nothing of this file has been stored yet; drop the upload.
    await db.orm.StoredFile.where({ id }).delete();
    return fail(400, "rejected", { message: "The file content does not match its type." });
  }
  const chunkRow = { id: `${id}:${index}`, fileId: id, chunkIndex: index, data: Buffer.from(bytes).toString("base64") };
  await db.orm.StoredFileChunk.upsert({ create: chunkRow, update: chunkRow });

  const received = await db.orm.StoredFileChunk.select("id").where({ fileId: id }).all();
  if (received.length < file.chunkCount) return NextResponse.json({ ok: true, complete: false });

  const now = new Date().toISOString();
  const completed = await db.transaction(async (orm) => {
    const fresh = await orm.StoredFile.where({ id }).first();
    if (!fresh || fresh.completedAt) return false;
    await orm.StoredFile.where({ id }).update({ completedAt: toTimestamptz(now) });
    const app = await orm.AdoptionApplication.select("documents").where({ applicationId: file.ownerId }).first();
    const docs = app?.documents ? (JSON.parse(app.documents) as ApplicationDocument[]) : [];
    docs.push({
      id,
      fileName: file.fileName,
      fileSizeKB: Math.max(1, Math.round(file.sizeBytes / 1024)),
      uploadedAt: now,
      contentType: file.contentType,
      stored: true,
    });
    // An upload after Staff asked for more documents answers that request.
    await orm.AdoptionApplication.where({ applicationId: file.ownerId }).update({
      documents: JSON.stringify(docs),
      ...(access.answersRequest ? { infoRespondedAt: toTimestamptz(now) } : {}),
    });
    await orm.AuditLogEntry.create(
      auditRow({
        actor: { email: auth.email, name: auth.displayName },
        action: access.answersRequest ? "Upload Requested Application Document" : "Upload Application Document",
        entityType: "Animal",
        entityId: access.animalId ?? file.ownerId,
        oldValue: "",
        newValue: `applicationId=${file.ownerId}; file=${file.fileName}; ${file.sizeBytes} bytes`,
      }),
    );
    return true;
  });
  return NextResponse.json({ ok: true, complete: completed });
}
