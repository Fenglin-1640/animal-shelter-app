import type { Animal } from "@/lib/animals/types";
import { writeAuditLog } from "@/lib/audit/store";

// Animals now live in the database (see prisma/contract.prisma) behind
// /api/animals - see prisma/README.md for what's different about this
// Prisma toolchain. This module used to read/write localStorage (the 10
// PRD 12.1 seed animals as a static import, plus a "created animals" and
// a field-level "overrides" array); the seed animals now come from
// prisma/seed.ts and everything is one real Animal row, so every export
// here is async now. AuditLog stays a client-side/localStorage prototype
// feature for this pilot slice, so it's still written here, after a
// successful API call, the same as before.

export interface StatusActor {
  email: string;
  name: string;
}

export async function addAnimal(animal: Animal, actor?: StatusActor): Promise<void> {
  await fetch("/api/animals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(animal),
  });
  // BR-014: every status change is written to StatusHistory and
  // AuditLog. Creation is the first entry for this Animal - oldValue is
  // empty since nothing existed before it.
  if (actor) {
    writeAuditLog({
      userId: actor.email,
      userName: actor.name,
      action: "Create Animal (Finalise Intake)",
      entityType: "Animal",
      entityId: animal.animalId,
      oldValue: "",
      newValue: `currentStatus=${animal.currentStatus}, listingStatus=${animal.listingStatus}`,
      result: "Success",
    });
  }
}

export async function updateAnimal(animalId: string, patch: Partial<Animal>): Promise<void> {
  await fetch(`/api/animals/${animalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export type ChangeStatusResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "invalid_transition" };

// Centralized entry point for any currentStatus/listingStatus change, so
// every transition is validated against the PRD 7.1 state table and
// recorded in the AuditLog (BR-014), instead of every feature module
// calling updateAnimal() directly with its own ad hoc status literal.
// Role authorization for WHO may trigger a given transition is enforced
// at the point of action (each screen/store function already gates this
// per its FR's named actor, e.g. Veterinarian-only for Medical actions);
// this function validates the state machine shape and writes the audit
// trail, not a second parallel role check, since a prototype without
// real server-side sessions has nowhere else for that check to live than
// the call site that already has the signed-in user's role in scope.
export async function changeAnimalStatus(
  animalId: string,
  patch: Partial<Pick<Animal, "currentStatus" | "listingStatus" | "statusUpdatedAt" | "linkedPerson">>,
  actor: StatusActor,
  action: string,
): Promise<ChangeStatusResult> {
  const response = await fetch(`/api/animals/${animalId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const result = await response.json();
  if (!result.ok) {
    return result;
  }

  writeAuditLog({
    userId: actor.email,
    userName: actor.name,
    action,
    entityType: "Animal",
    entityId: animalId,
    oldValue: result.oldValue,
    newValue: result.newValue,
    result: "Success",
  });

  return { ok: true };
}

export async function getAllAnimals(): Promise<Animal[]> {
  const response = await fetch("/api/animals");
  const result = await response.json();
  return result.animals as Animal[];
}

export async function getAnimalById(animalId: string): Promise<Animal | undefined> {
  const response = await fetch(`/api/animals/${animalId}`);
  if (!response.ok) return undefined;
  const result = await response.json();
  return result.ok ? (result.animal as Animal) : undefined;
}

export function generateShelterId(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SH-${year}-${suffix}`;
}
