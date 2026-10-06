import { acceptTransfer } from "@/lib/council-transfers/store";
import type { RegisteredOwnerContact } from "@/lib/microchip/types";
import {
  type IntakeRecord,
  type IntakeRecordFormInput,
} from "@/lib/intake-records/types";
import { getJson, send } from "@/lib/shared/http";

// FR-INT-02: IntakeRecord now lives in the database (see
// prisma/contract.prisma) behind /api/intake-records - see
// prisma/README.md for this Prisma toolchain's quirks.

async function fetchAll(): Promise<IntakeRecord[]> {
  const result = await getJson("/api/intake-records");
  return result.items as IntakeRecord[];
}

// adoptionFee also accepts null: JSON.stringify drops undefined keys, so
// clearing a previously saved fee has to be sent as an explicit null.
type IntakeRecordPatch = Omit<Partial<IntakeRecord>, "adoptionFee"> & { adoptionFee?: number | null };

async function patchIntakeRecord(intakeId: string, patch: IntakeRecordPatch): Promise<IntakeRecord | undefined> {
  const response = await send(`/api/intake-records/${intakeId}`, {
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

// The list (fetchAll) leaves out intake photos' imageData; the single-
// record endpoint returns it, which the Intake Record form's previews
// and Finalise Intake's copy into Photo records both need.
export async function getIntakeRecord(intakeId: string): Promise<IntakeRecord | undefined> {
  const result = await getJson(`/api/intake-records/${encodeURIComponent(intakeId)}`);
  return result.ok ? (result.item as IntakeRecord) : undefined;
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
  await send("/api/intake-records", {
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
  | { ok: true; intakeId: string; animalId: string }
  | { ok: false; reason: "not_found" | "already_finalised" | "blocked" | "failed"; blockers?: string[] };

// Save and Finalise Intake in one server transaction: validates the form,
// saves the record (a new one, or the draft intakeId) and finalises it -
// the Animal (Under Assessment / Not Fit), its three assessment tasks,
// its photos (the first one public) and a linked Council Transfer
// accepted - all audited. If anything is missing nothing is saved and the
// unmet conditions come back as blockers.
export async function saveAndFinaliseIntake(intakeId: string | undefined, input: IntakeRecordFormInput): Promise<FinaliseResult> {
  return postFinalise({ intakeId, input });
}

// Finalises a saved draft as stored.
export async function finaliseIntake(intakeId: string): Promise<FinaliseResult> {
  return postFinalise({ intakeId });
}

async function postFinalise(body: { intakeId?: string; input?: IntakeRecordFormInput }): Promise<FinaliseResult> {
  const response = await send("/api/intake-records/finalise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({ ok: false, reason: "failed" }));
  if (result.ok) return { ok: true, intakeId: result.intakeId, animalId: result.animalId };
  return { ok: false, reason: result.reason ?? "failed", blockers: result.blockers };
}
