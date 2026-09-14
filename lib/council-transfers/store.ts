import type {
  CouncilTransferSubmission,
  TransferFormInput,
} from "@/lib/council-transfers/types";

// FR-INT-01: Council Transfer Submissions, persisted to localStorage
// since there is no backend.
const STORAGE_KEY = "asams-council-transfers";

function loadAll(): CouncilTransferSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CouncilTransferSubmission[]) : [];
  } catch {
    return [];
  }
}

function saveAll(all: CouncilTransferSubmission[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function listMyTransfers(email: string): CouncilTransferSubmission[] {
  const normalized = email.trim().toLowerCase();
  return loadAll().filter((t) => t.submittedByEmail.toLowerCase() === normalized);
}

export function getTransfer(id: string): CouncilTransferSubmission | undefined {
  return loadAll().find((t) => t.id === id);
}

// Staff/Administrator see all officers' submissions (PRD section 9:
// Council Transfer "查看全部、接受"), not just their own.
export function listAllTransfers(): CouncilTransferSubmission[] {
  return loadAll();
}

export function listSubmittedTransfers(): CouncilTransferSubmission[] {
  return loadAll().filter((t) => t.status === "Submitted");
}

function generateId(): string {
  return `CTS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function createDraft(
  email: string,
  name: string,
  input: TransferFormInput,
): string {
  const id = generateId();
  const now = new Date().toISOString();
  const record: CouncilTransferSubmission = {
    id,
    submittedByEmail: email,
    submittedByName: name,
    ...input,
    status: "Draft",
    createdAt: now,
    updatedAt: now,
  };
  saveAll([...loadAll(), record]);
  return id;
}

export type MutationResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_editable" }
  | { ok: false; reason: "missing_fields" }
  | { ok: false; reason: "missing_attachment" };

export function updateDraft(id: string, input: TransferFormInput): MutationResult {
  const all = loadAll();
  const index = all.findIndex((t) => t.id === id);
  if (index === -1) return { ok: false, reason: "not_found" };
  if (all[index].status !== "Draft") return { ok: false, reason: "not_editable" };

  all[index] = { ...all[index], ...input, updatedAt: new Date().toISOString() };
  saveAll(all);
  return { ok: true };
}

export function submitTransfer(id: string): MutationResult {
  const all = loadAll();
  const index = all.findIndex((t) => t.id === id);
  if (index === -1) return { ok: false, reason: "not_found" };
  const record = all[index];
  if (record.status !== "Draft") return { ok: false, reason: "not_editable" };

  if (
    !record.source.trim() ||
    !record.arrivalCircumstance.trim() ||
    !record.foundLocation.trim() ||
    !record.animalDescription.trim()
  ) {
    return { ok: false, reason: "missing_fields" };
  }
  if (record.attachments.length === 0) {
    return { ok: false, reason: "missing_attachment" };
  }

  const now = new Date().toISOString();
  all[index] = { ...record, status: "Submitted", submissionDate: now, updatedAt: now };
  saveAll(all);
  return { ok: true };
}

// FR-INT-01 acceptance criterion 4: "Staff 接受转移后，相关资料链接到正式
// IntakeRecord" - accepting a transfer IS Staff linking it to a formal
// Intake Record, so this is called as a side effect of that linkage
// (lib/intake-records/store.ts), not from a separate "Accept" button.
// A no-op if the transfer isn't currently Submitted (idempotent).
export function acceptTransfer(id: string): MutationResult {
  const all = loadAll();
  const index = all.findIndex((t) => t.id === id);
  if (index === -1) return { ok: false, reason: "not_found" };
  if (all[index].status !== "Submitted") return { ok: true };

  all[index] = { ...all[index], status: "Accepted", updatedAt: new Date().toISOString() };
  saveAll(all);
  return { ok: true };
}
