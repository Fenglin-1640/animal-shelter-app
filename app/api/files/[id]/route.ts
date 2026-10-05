import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { ALL_ROLES } from "@/lib/auth/api-roles";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toStoredFileMeta } from "@/lib/files/rules";
import { fail, ownerAccess } from "@/lib/files/server";
import type { ApplicationDocument } from "@/lib/applications/types";

type Params = { params: Promise<{ id: string }> };

// One stored file's metadata (for downloading it chunk by chunk).
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const file = await db.orm.StoredFile.where({ id }).first();
  if (!file?.completedAt) return fail(404, "not_found");
  const access = await ownerAccess(auth, file.ownerType, file.ownerId);
  if (!access?.canRead) return forbidden();
  return NextResponse.json({ ok: true, item: toStoredFileMeta(file) });
}

// Removes a file (the owning Adopter, while the application is a Draft),
// with its chunks, its entry on the application and an audit entry.
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const file = await db.orm.StoredFile.where({ id }).first();
  if (!file) return fail(404, "not_found");
  const access = await ownerAccess(auth, file.ownerType, file.ownerId);
  if (!access?.canWrite) return forbidden();

  const chunks = await db.orm.StoredFileChunk.select("id").where({ fileId: id }).all();
  await db.transaction(async (orm) => {
    for (const c of chunks) await orm.StoredFileChunk.where({ id: c.id }).delete();
    await orm.StoredFile.where({ id }).delete();
    if (file.completedAt) {
      const app = await orm.AdoptionApplication.select("documents").where({ applicationId: file.ownerId }).first();
      const docs = (app?.documents ? (JSON.parse(app.documents) as ApplicationDocument[]) : []).filter((d) => d.id !== id);
      await orm.AdoptionApplication.where({ applicationId: file.ownerId }).update({ documents: JSON.stringify(docs) });
      await orm.AuditLogEntry.create(
        auditRow({
          actor: { email: auth.email, name: auth.displayName },
          action: "Remove Application Document",
          entityType: "Animal",
          entityId: access.animalId ?? file.ownerId,
          oldValue: `applicationId=${file.ownerId}; file=${file.fileName}`,
          newValue: "",
        }),
      );
    }
  });
  return NextResponse.json({ ok: true });
}
