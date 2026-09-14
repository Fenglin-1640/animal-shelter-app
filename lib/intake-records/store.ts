import { acceptTransfer } from "@/lib/council-transfers/store";
import type { IntakeRecord, IntakeRecordFormInput } from "@/lib/intake-records/types";

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
