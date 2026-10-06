import type { Animal } from "@/lib/animals/types";
import { writeAuditLog } from "@/lib/audit/store";
import { getJson, send } from "@/lib/shared/http";

// Animals now live in the database (see prisma/contract.prisma) behind
// /api/animals - see prisma/README.md for what's different about this
// Prisma toolchain. This module used to read/write localStorage (the 10
// PRD 12.1 seed animals as a static import, plus a "created animals" and
// a field-level "overrides" array); the seed animals now come from
// prisma/seed.ts and everything is one real Animal row, so every export
// here is async now. AuditLog is also database-backed now
// (lib/audit/store.ts) and written here after a successful API call,
// the same as before.

export interface StatusActor {
  email: string;
  name: string;
}

export async function updateAnimal(animalId: string, patch: Partial<Animal>): Promise<void> {
  await send(`/api/animals/${animalId}`, {
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
// at the point of action (each screen/store function gates this per its
// FR's named actor, e.g. Veterinarian-only for Medical actions) and by
// the API route guards (lib/auth/server-session.ts: the status route
// admits the care-team roles, and the action's own route - e.g. a
// Veterinarian-only medical write - rejects anyone else); this function
// validates the state machine shape and writes the audit trail.
export async function changeAnimalStatus(
  animalId: string,
  patch: Partial<Pick<Animal, "currentStatus" | "listingStatus" | "statusUpdatedAt" | "linkedPerson">>,
  actor: StatusActor,
  action: string,
): Promise<ChangeStatusResult> {
  const response = await send(`/api/animals/${animalId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const result = await response.json();
  if (!result.ok) {
    return result;
  }

  await writeAuditLog({
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
  const result = await getJson("/api/animals");
  return result.animals as Animal[];
}

export async function getAnimalById(animalId: string): Promise<Animal | undefined> {
  // A missing animal comes back as { ok: false } (404), as does any
  // non-JSON error response - both map to undefined, as before.
  const result = await getJson(`/api/animals/${animalId}`);
  return result.ok ? (result.animal as Animal) : undefined;
}
