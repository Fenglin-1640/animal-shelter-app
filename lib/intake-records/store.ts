import { acceptTransfer, getTransfer } from "@/lib/council-transfers/store";
import { addAnimal, generateShelterId } from "@/lib/animals/animal-store";
import { createTasksForAnimal } from "@/lib/adoption-fitness/store";
import { seedPhotosFromIntake } from "@/lib/photos/store";
import { getBreedsForSpecies } from "@/lib/options/breeds";
import type { Animal } from "@/lib/animals/types";
import type { RegisteredOwnerContact } from "@/lib/microchip/types";
import {
  getFinaliseBlockers,
  type IntakeRecord,
  type IntakeRecordFormInput,
} from "@/lib/intake-records/types";

// FR-INT-02: IntakeRecord now lives in the database (see
// prisma/contract.prisma) behind /api/intake-records - see
// prisma/README.md for this Prisma toolchain's quirks.

async function fetchAll(): Promise<IntakeRecord[]> {
  const response = await fetch("/api/intake-records");
  const result = await response.json();
  return result.items as IntakeRecord[];
}

// adoptionFee also accepts null: JSON.stringify drops undefined keys, so
// clearing a previously saved fee has to be sent as an explicit null.
type IntakeRecordPatch = Omit<Partial<IntakeRecord>, "adoptionFee"> & { adoptionFee?: number | null };

async function patchIntakeRecord(intakeId: string, patch: IntakeRecordPatch): Promise<IntakeRecord | undefined> {
  const response = await fetch(`/api/intake-records/${intakeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const result = await response.json();
  if (!result.ok) return undefined;
  return result.item as IntakeRecord;
}

export async function listIntakeRecords(): Promise<IntakeRecord[]> {
  return fetchAll();
}

export async function getIntakeRecord(intakeId: string): Promise<IntakeRecord | undefined> {
  return (await fetchAll()).find((r) => r.intakeId === intakeId);
}

// Council Transfer submissions already linked to some intake record,
// keyed by transfer id - used to keep a transfer from being linked twice.
export async function listLinkedTransferIds(excludingIntakeId?: string): Promise<Set<string>> {
  return new Set(
    (await fetchAll())
      .filter((r) => r.intakeId !== excludingIntakeId && r.councilTransferSubmissionId)
      .map((r) => r.councilTransferSubmissionId as string),
  );
}

export async function getIntakeRecordByAnimalId(animalId: string): Promise<IntakeRecord | undefined> {
  return (await fetchAll()).find((r) => r.animalId === animalId);
}

// FR-MC-02 step 1. A no-op if this animal has no formal IntakeRecord
// (e.g. the static PRD 12.1 seed animals, which predate Finalise Intake).
export async function linkRegisteredOwnerContact(animalId: string, contact: RegisteredOwnerContact): Promise<void> {
  const record = await getIntakeRecordByAnimalId(animalId);
  if (!record) return;
  await patchIntakeRecord(record.intakeId, { registeredOwnerContact: contact, updatedAt: new Date().toISOString() });
}

function generateIntakeId(): string {
  return `IN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateAnimalId(): string {
  return `A-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createIntakeRecord(
  email: string,
  name: string,
  input: IntakeRecordFormInput,
): Promise<string> {
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
  await fetch("/api/intake-records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });

  if (record.councilTransferSubmissionId) {
    await acceptTransfer(record.councilTransferSubmissionId);
  }

  return record.intakeId;
}

export type MutationResult = { ok: true } | { ok: false; reason: "not_found" };

export async function updateIntakeRecord(
  intakeId: string,
  input: IntakeRecordFormInput,
): Promise<MutationResult> {
  const updated = await patchIntakeRecord(intakeId, {
    ...input,
    adoptionFee: input.adoptionFee ?? null,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return { ok: false, reason: "not_found" };

  if (input.councilTransferSubmissionId) {
    await acceptTransfer(input.councilTransferSubmissionId);
  }

  return { ok: true };
}

export type FinaliseResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_finalised" | "blocked"; blockers?: string[] };

// FR-INT-03: Finalise Intake creates the Animal record (+ initial status
// fields) from a completed Intake Record - including the Breed, Adoption
// Fee, Temperaments and General Description captured at intake, so the
// Animal already has FR-LIST-01's publish fields - and (FR-INT-04) the 3 parallel
// assessment tasks Review Adoption Fitness gates on. A separate
// MedicalRecord is not persisted here - nothing in this prototype
// reads/displays one yet, so an empty shell object would have no
// observable effect.
export async function finaliseIntake(intakeId: string, email: string, name: string): Promise<FinaliseResult> {
  const record = await getIntakeRecord(intakeId);
  if (!record) return { ok: false, reason: "not_found" };
  if (record.finalisedAt) return { ok: false, reason: "already_finalised" };

  const linkedTransfer = record.councilTransferSubmissionId
    ? await getTransfer(record.councilTransferSubmissionId)
    : undefined;
  const blockers = getFinaliseBlockers(record, linkedTransfer);
  if (blockers.length > 0) return { ok: false, reason: "blocked", blockers };

  const species = record.species || "Cat";
  const breedOption = (await getBreedsForSpecies(species)).find((b) => b.name === record.breed);

  const now = new Date().toISOString();
  const animal: Animal = {
    animalId: record.animalId,
    shelterId: generateShelterId(),
    name: record.animalName,
    species,
    breed: record.breed,
    breedDescription: breedOption?.description ?? "",
    sex: record.sex || "Male",
    dateOfBirth: record.dateOfBirth || undefined,
    estimatedAge: record.estimatedAge || undefined,
    coatColour: record.coatColour,
    coatMarkings: record.coatMarkings,
    generalDescription: record.generalDescription,
    temperaments: record.temperaments,
    adoptionFee: record.adoptionFee,
    currentStatus: "Under Assessment",
    listingStatus: "Not Fit",
    statusUpdatedAt: now,
    enteredAt: now,
    lastModifiedAt: now,
    intakeSource: record.intakeSource,
  };
  await addAnimal(animal, { email, name });
  await createTasksForAnimal(animal.animalId);
  await seedPhotosFromIntake(animal.animalId, record.photos, record.createdByEmail, record.createdByName);

  await patchIntakeRecord(intakeId, { finalisedAt: now, updatedAt: now });

  return { ok: true };
}
