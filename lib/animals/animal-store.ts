import { MOCK_ANIMALS } from "@/lib/animals/mock-animals";
import { isValidStatusTransition } from "@/lib/animals/status-rules";
import type { Animal } from "@/lib/animals/types";
import { writeAuditLog } from "@/lib/audit/store";

// Animals created via Finalise Intake (FR-INT-03), kept separate from the
// static PRD 12.1 seed animals. Persisted to localStorage since there is
// no backend.
const STORAGE_KEY = "asams-created-animals";

// Field-level edits (e.g. microchipNumber written back by Scan Microchip,
// FR-MC-01) layered on top of a base record - same overlay pattern as
// lib/user-administration/directory-store.ts, needed because the 10 PRD
// 12.1 seed animals are static imports, not localStorage-backed records
// that could otherwise be mutated in place.
const OVERRIDES_KEY = "asams-animal-overrides";

function loadCreatedAnimals(): Animal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Animal[]) : [];
  } catch {
    return [];
  }
}

function saveCreatedAnimals(animals: Animal[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(animals));
}

function loadOverrides(): Record<string, Partial<Animal>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, Partial<Animal>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

export interface StatusActor {
  email: string;
  name: string;
}

export function addAnimal(animal: Animal, actor?: StatusActor) {
  saveCreatedAnimals([...loadCreatedAnimals(), animal]);
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

export function updateAnimal(animalId: string, patch: Partial<Animal>) {
  const overrides = loadOverrides();
  overrides[animalId] = { ...overrides[animalId], ...patch };
  saveOverrides(overrides);
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
// trail, not a second parallel role check, since a prototype without a
// server-side API boundary has nowhere else for that check to live than
// the call site that already has the signed-in user's role in scope.
export function changeAnimalStatus(
  animalId: string,
  patch: Partial<Pick<Animal, "currentStatus" | "listingStatus" | "statusUpdatedAt" | "linkedPerson">>,
  actor: StatusActor,
  action: string,
): ChangeStatusResult {
  const animal = getAnimalById(animalId);
  if (!animal) return { ok: false, reason: "not_found" };

  if (patch.currentStatus && !isValidStatusTransition(animal.currentStatus, patch.currentStatus)) {
    return { ok: false, reason: "invalid_transition" };
  }

  const oldValue = `currentStatus=${animal.currentStatus}, listingStatus=${animal.listingStatus}`;
  updateAnimal(animalId, patch);

  if (patch.currentStatus || patch.listingStatus) {
    const newValue = `currentStatus=${patch.currentStatus ?? animal.currentStatus}, listingStatus=${patch.listingStatus ?? animal.listingStatus}`;
    writeAuditLog({
      userId: actor.email,
      userName: actor.name,
      action,
      entityType: "Animal",
      entityId: animalId,
      oldValue,
      newValue,
      result: "Success",
    });
  }

  return { ok: true };
}

export function getAllAnimals(): Animal[] {
  const overrides = loadOverrides();
  return [...MOCK_ANIMALS, ...loadCreatedAnimals()].map((animal) =>
    overrides[animal.animalId] ? { ...animal, ...overrides[animal.animalId] } : animal,
  );
}

export function getAnimalById(animalId: string): Animal | undefined {
  return getAllAnimals().find((a) => a.animalId === animalId);
}

export function generateShelterId(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SH-${year}-${suffix}`;
}
