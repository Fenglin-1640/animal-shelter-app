import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { auditRow } from "@/lib/audit/server";
import { CARE_TEAM, STAFF } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toTimestamptz } from "@/lib/db/temporal";
import { toMicrochipImplantTask } from "@/lib/microchip/implant";

// Microchip implant tasks. ?animalId= / ?status= narrow the list.
export async function GET(request: Request) {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const params = new URL(request.url).searchParams;
  const where: { animalId?: string; status?: string } = {};
  const animalId = params.get("animalId");
  const status = params.get("status");
  if (animalId) where.animalId = animalId;
  if (status) where.status = status;
  const rows = await db.orm.MicrochipImplantTask.where(where).all();
  return NextResponse.json({ items: rows.map(toMicrochipImplantTask) });
}

// 15 digits with the prefix 036.
function candidateNumber(): string {
  let digits = "036";
  for (let i = 0; i < 12; i++) digits += String(randomInt(0, 10));
  return digits;
}

// Checked against every number already in use: animals, scan records and
// other implant tasks.
async function isTaken(number: string): Promise<boolean> {
  const [animal, lookup, task] = await Promise.all([
    db.orm.Animal.select("animalId").where({ microchipNumber: number }).first(),
    db.orm.MicrochipLookup.select("id").where({ microchipNumber: number }).first(),
    db.orm.MicrochipImplantTask.select("id").where({ assignedNumber: number }).first(),
  ]);
  return Boolean(animal || lookup || task);
}

// Scan Microchip found no chip: assign a new, globally unique number and
// give the Veterinarian an implant task, audited in the same transaction.
// Idempotent - an animal with a pending implant task gets that task back.
export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const { animalId } = (await request.json()) as { animalId?: string };
  if (!animalId) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const animal = await db.orm.Animal.select("animalId").where({ animalId }).first();
  if (!animal) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const pending = await db.orm.MicrochipImplantTask.where({ animalId, status: "Pending" }).first();
  if (pending) return NextResponse.json({ ok: true, item: toMicrochipImplantTask(pending) });

  for (let attempt = 0; attempt < 10; attempt++) {
    const number = candidateNumber();
    if (await isTaken(number)) continue;
    try {
      const created = await db.transaction(async (orm) => {
        const row = await orm.MicrochipImplantTask.create({
          id: `MIT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          animalId,
          assignedNumber: number,
          status: "Pending",
          createdByEmail: auth.email,
          createdByName: auth.displayName,
          createdAt: toTimestamptz(new Date().toISOString()),
          completedByEmail: null,
          completedByName: null,
          completedAt: null,
        });
        await orm.AuditLogEntry.create(
          auditRow({
            actor: { email: auth.email, name: auth.displayName },
            action: "No Chip - Microchip Number Assigned",
            entityType: "Animal",
            entityId: animalId,
            oldValue: "No microchip",
            newValue: `Microchip ${number} assigned - implant by Veterinarian pending`,
          }),
        );
        return row;
      });
      return NextResponse.json({ ok: true, item: toMicrochipImplantTask(created) });
    } catch {
      // Lost a race for this number (unique constraint) - try another.
    }
  }
  return NextResponse.json({ ok: false, reason: "number_unavailable" }, { status: 500 });
}
