import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAnimal, toAnimalRowPatch } from "@/lib/animals/serialize";
import type { Animal } from "@/lib/animals/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await db.orm.Animal.where({ animalId: id }).first();
  if (!row) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, animal: toAnimal(row) });
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
