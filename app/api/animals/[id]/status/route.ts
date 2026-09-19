import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toAnimalRowPatch } from "@/lib/animals/serialize";
import { isValidStatusTransition } from "@/lib/animals/status-rules";
import type { Animal } from "@/lib/animals/types";

type StatusPatch = Partial<
  Pick<Animal, "currentStatus" | "listingStatus" | "statusUpdatedAt" | "linkedPerson">
>;

// Centralized entry point for any currentStatus/listingStatus change
// (BR-014), same role this endpoint's caller - changeAnimalStatus() in
// lib/animals/animal-store.ts - played before the database existed.
// Validates the transition against the PRD 7.1 state table; the caller
// writes the AuditLog entry (database-backed, see /api/audit-log) using
// the oldValue/newValue this returns.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as StatusPatch;

  const animal = await db.orm.Animal.where({ animalId: id }).first();
  if (!animal) {
    return NextResponse.json({ ok: false, reason: "not_found" });
  }

  if (
    patch.currentStatus &&
    !isValidStatusTransition(animal.currentStatus as Animal["currentStatus"], patch.currentStatus)
  ) {
    return NextResponse.json({ ok: false, reason: "invalid_transition" });
  }

  const oldValue = `currentStatus=${animal.currentStatus}, listingStatus=${animal.listingStatus}`;
  await db.orm.Animal.where({ animalId: id }).update(toAnimalRowPatch(patch));

  const newValue = `currentStatus=${patch.currentStatus ?? animal.currentStatus}, listingStatus=${patch.listingStatus ?? animal.listingStatus}`;

  return NextResponse.json({ ok: true, oldValue, newValue });
}
