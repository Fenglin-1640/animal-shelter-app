import type {
  CouncilTransferSubmission,
  TransferFormInput,
} from "@/lib/council-transfers/types";
import { getJson, send } from "@/lib/shared/http";

// FR-INT-01: CouncilTransferSubmission now lives in the database (see
// prisma/contract.prisma) behind /api/council-transfers - see
// prisma/README.md for this Prisma toolchain's quirks.

async function fetchAll(): Promise<CouncilTransferSubmission[]> {
  const result = await getJson("/api/council-transfers");
  return result.items as CouncilTransferSubmission[];
}

async function patchTransfer(id: string, patch: Partial<CouncilTransferSubmission>): Promise<MutationResult> {
  const response = await send(`/api/council-transfers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const result = await response.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };
  return { ok: true };
}

export async function listMyTransfers(email: string): Promise<CouncilTransferSubmission[]> {
  const normalized = email.trim().toLowerCase();
  return (await fetchAll()).filter((t) => t.submittedByEmail.toLowerCase() === normalized);
}

export async function getTransfer(id: string): Promise<CouncilTransferSubmission | undefined> {
  return (await fetchAll()).find((t) => t.id === id);
}

// Staff/Administrator see all officers' submissions (PRD section 9:
// Council Transfer "查看全部、接受"), not just their own.
export async function listAllTransfers(): Promise<CouncilTransferSubmission[]> {
  return fetchAll();
}

export async function listSubmittedTransfers(): Promise<CouncilTransferSubmission[]> {
  return (await fetchAll()).filter((t) => t.status === "Submitted");
}

function generateId(): string {
  return `CTS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createDraft(
  email: string,
  name: string,
  input: TransferFormInput,
): Promise<string> {
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
  await send("/api/council-transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  return id;
}

export type MutationResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_editable" }
  | { ok: false; reason: "missing_fields" }
  | { ok: false; reason: "missing_attachment" };

export async function updateDraft(id: string, input: TransferFormInput): Promise<MutationResult> {
  const record = await getTransfer(id);
  if (!record) return { ok: false, reason: "not_found" };
  if (record.status !== "Draft") return { ok: false, reason: "not_editable" };

  return patchTransfer(id, { ...input, updatedAt: new Date().toISOString() });
}

export async function submitTransfer(id: string): Promise<MutationResult> {
  const record = await getTransfer(id);
  if (!record) return { ok: false, reason: "not_found" };
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
  return patchTransfer(id, { status: "Submitted", submissionDate: now, updatedAt: now });
}

// FR-INT-01 acceptance criterion 4: "Staff 接受转移后，相关资料链接到正式
// IntakeRecord" - accepting a transfer IS Staff linking it to a formal
// Intake Record, so this is called as a side effect of that linkage
// (lib/intake-records/store.ts), not from a separate "Accept" button.
// A no-op if the transfer isn't currently Submitted (idempotent).
export async function acceptTransfer(id: string): Promise<MutationResult> {
  const record = await getTransfer(id);
  if (!record) return { ok: false, reason: "not_found" };
  if (record.status !== "Submitted") return { ok: true };

  return patchTransfer(id, { status: "Accepted", updatedAt: new Date().toISOString() });
}
