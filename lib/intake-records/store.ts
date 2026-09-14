import { acceptTransfer, getTransfer } from "@/lib/council-transfers/store";
import { addAnimal, generateShelterId } from "@/lib/animals/animal-store";
import { createTasksForAnimal } from "@/lib/adoption-fitness/store";
import type { Animal } from "@/lib/animals/types";
import type { RegisteredOwnerContact } from "@/lib/microchip/types";
import {
  getFinaliseBlockers,
  type IntakeRecord,
  type IntakeRecordFormInput,
} from "@/lib/intake-records/types";

// FR-INT-02: formal Intake Records, persisted to localStorage since
// there is no backend.
const STORAGE_KEY = "asams-intake-records";

function loadAll(): IntakeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IntakeRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAll(all: IntakeRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function listIntakeRecords(): IntakeRecord[] {
  return loadAll();
}

export function getIntakeRecord(intakeId: string): IntakeRecord | undefined {
  return loadAll().find((r) => r.intakeId === intakeId);
}

// Council Transfer submissions already linked to some intake record,
// keyed by transfer id - used to keep a transfer from being linked twice.
export function listLinkedTransferIds(excludingIntakeId?: string): Set<string> {
  return new Set(
    loadAll()
      .filter((r) => r.intakeId !== excludingIntakeId && r.councilTransferSubmissionId)
      .map((r) => r.councilTransferSubmissionId as string),
  );
}

export function getIntakeRecordByAnimalId(animalId: string): IntakeRecord | undefined {
  return loadAll().find((r) => r.animalId === animalId);
}

// FR-MC-02 step 1. A no-op if this animal has no formal IntakeRecord
// (e.g. the static PRD 12.1 seed animals, which predate Finalise Intake).
export function linkRegisteredOwnerContact(animalId: string, contact: RegisteredOwnerContact) {
  const all = loadAll();
  const index = all.findIndex((r) => r.animalId === animalId);
  if (index === -1) return;
  all[index] = { ...all[index], registeredOwnerContact: contact, updatedAt: new Date().toISOString() };
  saveAll(all);
}

function generateIntakeId(): string {
  return `IN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateAnimalId(): string {
  return `A-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function createIntakeRecord(
  email: string,
  name: string,
  input: IntakeRecordFormInput,
): string {
  const now = new Date().toISOString();
  const record: IntakeRecord = {
    intakeId: generateIntakeId(),
    animalId: generateAnimalId(),
    createdByEmail: email,
    createdByName: name,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  saveAll([...loadAll(), record]);

  if (record.councilTransferSubmissionId) {
    acceptTransfer(record.councilTransferSubmissionId);
  }

  return record.intakeId;
}

export type MutationResult = { ok: true } | { ok: false; reason: "not_found" };

export function updateIntakeRecord(
  intakeId: string,
  input: IntakeRecordFormInput,
): MutationResult {
  const all = loadAll();
  const index = all.findIndex((r) => r.intakeId === intakeId);
  if (index === -1) return { ok: false, reason: "not_found" };

  all[index] = { ...all[index], ...input, updatedAt: new Date().toISOString() };
  saveAll(all);

  if (input.councilTransferSubmissionId) {
    acceptTransfer(input.councilTransferSubmissionId);
  }

  return { ok: true };
}

export type FinaliseResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_finalised" | "blocked"; blockers?: string[] };

// FR-INT-03: Finalise Intake creates the Animal record (+ initial status
// fields) from a completed Intake Record, and (FR-INT-04) the 3 parallel
// assessment tasks Review Adoption Fitness gates on. A separate
// MedicalRecord is not persisted here - nothing in this prototype
// reads/displays one yet, so an empty shell object would have no
// observable effect.
export function finaliseIntake(intakeId: string): FinaliseResult {
  const all = loadAll();
  const index = all.findIndex((r) => r.intakeId === intakeId);
  if (index === -1) return { ok: false, reason: "not_found" };

  const record = all[index];
  if (record.finalisedAt) return { ok: false, reason: "already_finalised" };

  const linkedTransfer = record.councilTransferSubmissionId
    ? getTransfer(record.councilTransferSubmissionId)
    : undefined;
  const blockers = getFinaliseBlockers(record, linkedTransfer);
  if (blockers.length > 0) return { ok: false, reason: "blocked", blockers };

  const now = new Date().toISOString();
  const animal: Animal = {
    animalId: record.animalId,
    shelterId: generateShelterId(),
    name: record.animalName,
    species: record.species || "Cat",
    breed: "Unknown",
    breedDescription: "",
    sex: record.sex || "Male",
    dateOfBirth: record.dateOfBirth || undefined,
    estimatedAge: record.estimatedAge || undefined,
    coatColour: record.coatColour,
    coatMarkings: record.coatMarkings,
    generalDescription: record.arrivalCircumstance,
    temperaments: [],
    currentStatus: "Under Assessment",
    listingStatus: "Not Fit",
    statusUpdatedAt: now,
    enteredAt: now,
    lastModifiedAt: now,
    intakeSource: record.intakeSource,
    photos: record.photos,
  };
  addAnimal(animal);
  createTasksForAnimal(animal.animalId);

  all[index] = { ...record, finalisedAt: now, updatedAt: now };
  saveAll(all);

  return { ok: true };
}
