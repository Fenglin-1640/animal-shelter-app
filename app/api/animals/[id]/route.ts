import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAnimal, toAnimalRowPatch } from "@/lib/animals/serialize";
import type { Animal } from "@/lib/animals/types";
import { requireRole } from "@/lib/auth/server-session";
import { toPublicAnimal } from "@/lib/animals/public";
import { ALL_ROLES, STAFF, seesAllRecords } from "@/lib/auth/api-roles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(ALL_ROLES);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const row = await db.orm.Animal.where({ animalId: id }).first();
  if (!row) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  // Adopters and Council Officers get public fields only (PRD 9.1).
  const animal = toAnimal(row);
  return NextResponse.json({ ok: true, animal: seesAllRecords(auth.role) ? animal : toPublicAnimal(animal) });
}

// Generic patch - mirrors the pre-database updateAnimal(animalId,
// patch: Partial<Animal>) contract exactly, since call sites across the
// app patch very different single fields (microchipNumber, listingStatus,
// ...) with no single shared business rule the way Users' role-status
// did. Status-machine validation lives in the dedicated status route.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const patch = (await request.json()) as Partial<Animal>;

  const existing = await db.orm.Animal.where({ animalId: id }).first();
  if (!existing) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const updated = await db.orm.Animal.where({ animalId: id }).update(toAnimalRowPatch(patch));
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, animal: toAnimal(updated) });
}
