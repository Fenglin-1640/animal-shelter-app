import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { VETERINARIAN } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toVaccinationTask } from "@/lib/medical/vaccination-check";

// Waives a pending vaccination item: Veterinarian only, reason required,
// audited in the same transaction.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const { reason } = (await request.json()) as { reason?: string };
  const text = reason?.trim() ?? "";
  if (!text) return NextResponse.json({ ok: false, reason: "invalid", message: "A reason is required." }, { status: 400 });
  const task = await db.orm.VaccinationTask.where({ id }).first();
  if (!task) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (task.status !== "Pending") return NextResponse.json({ ok: false, reason: "not_pending" }, { status: 409 });
  const updated = await db.transaction(async (orm) => {
    const saved = await orm.VaccinationTask.where({ id }).update({
      status: "Waived",
      waivedReason: text,
      resolvedByEmail: auth.email,
      resolvedByName: auth.displayName,
      resolvedAt: toTimestamptz(new Date().toISOString()),
    });
    await orm.AuditLogEntry.create(
      auditRow({
        actor: { email: auth.email, name: auth.displayName },
        action: "Waive Pending Vaccination",
        entityType: "MedicalRecord",
        entityId: task.animalId,
        oldValue: `vaccineType=${task.vaccineType}; status=Pending`,
        newValue: `status=Waived; reason=${text}`,
      }),
    );
    return saved;
  });
  return NextResponse.json({ ok: true, item: updated ? toVaccinationTask(updated) : null });
}
