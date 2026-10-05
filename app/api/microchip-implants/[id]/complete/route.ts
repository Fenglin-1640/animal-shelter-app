import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { VETERINARIAN } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toMicrochipImplantTask } from "@/lib/microchip/implant";

// The Veterinarian confirms the implant. In one transaction: the task is
// completed, the animal's microchip number is set to the assigned number,
// the Microchip Check fitness task is marked continuable, and it is all
// audited.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const task = await db.orm.MicrochipImplantTask.where({ id }).first();
  if (!task) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (task.status === "Completed") return NextResponse.json({ ok: false, reason: "already_completed" }, { status: 409 });
  const animal = await db.orm.Animal.select("animalId", "microchipNumber").where({ animalId: task.animalId }).first();
  if (!animal) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const now = new Date().toISOString();
  const actor = { email: auth.email, name: auth.displayName };
  const updated = await db.transaction(async (orm) => {
    const done = await orm.MicrochipImplantTask.where({ id }).update({
      status: "Completed",
      completedByEmail: auth.email,
      completedByName: auth.displayName,
      completedAt: toTimestamptz(now),
    });
    await orm.Animal.where({ animalId: task.animalId }).update({
      microchipNumber: task.assignedNumber,
      lastModifiedAt: toTimestamptz(now),
    });
    const check = await orm.AssessmentTask.where({ animalId: task.animalId, taskType: "Microchip Check" }).first();
    if (check && check.status !== "Continuable") {
      await orm.AssessmentTask.where({ id: check.id }).update({
        status: "Continuable",
        markedByEmail: auth.email,
        markedByName: auth.displayName,
        markedAt: toTimestamptz(now),
      });
    }
    await orm.AuditLogEntry.create(
      auditRow({
        actor,
        action: "Microchip Implanted",
        entityType: "Animal",
        entityId: task.animalId,
        oldValue: animal.microchipNumber ?? "No microchip",
        newValue: `Microchip ${task.assignedNumber} implanted`,
      }),
    );
    return done;
  });
  return NextResponse.json({ ok: true, item: updated ? toMicrochipImplantTask(updated) : null });
}
