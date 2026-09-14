import { CHECK_TYPES, type CheckOutcome, type SuitabilityCheck } from "@/lib/checks/types";

// FR-CHK-01: SuitabilityCheck records, persisted to localStorage since
// there is no backend.
const STORAGE_KEY = "asams-suitability-checks";

function loadAll(): SuitabilityCheck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SuitabilityCheck[]) : [];
  } catch {
    return [];
  }
}

function saveAll(checks: SuitabilityCheck[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
}

function generateCheckId(): string {
  return `CHK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// "每个已提交的 AdoptionApplication 必须自动建立三条 SuitabilityCheck" - called once,
// right after submitApplication() succeeds. Idempotent (a no-op if
// checks already exist for this application).
export function createChecksForApplication(applicationId: string) {
  const all = loadAll();
  if (all.some((c) => c.applicationId === applicationId)) return;
  const created: SuitabilityCheck[] = CHECK_TYPES.map((checkType) => ({
    checkId: generateCheckId(),
    applicationId,
    checkType,
    outcome: "Pending",
    checkNotes: "",
  }));
  saveAll([...all, ...created]);
}

export function listChecksForApplication(applicationId: string): SuitabilityCheck[] {
  return loadAll().filter((c) => c.applicationId === applicationId);
}

export function allChecksComplete(applicationId: string): boolean {
  const checks = listChecksForApplication(applicationId);
  return checks.length === CHECK_TYPES.length && checks.every((c) => c.outcome !== "Pending");
}

export function allChecksPass(applicationId: string): boolean {
  return allChecksComplete(applicationId) && listChecksForApplication(applicationId).every((c) => c.outcome === "Pass");
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

export function completeCheck(
  checkId: string,
  outcome: Exclude<CheckOutcome, "Pending">,
  checkNotes: string,
  conductedDate: string,
  email: string,
  name: string,
): MutationResult {
  const all = loadAll();
  const index = all.findIndex((c) => c.checkId === checkId);
  if (index === -1) return { ok: false, reason: "not_found" };

  all[index] = {
    ...all[index],
    outcome,
    checkNotes,
    conductedDate,
    completedByEmail: email,
    completedByName: name,
  };
  saveAll(all);
  return { ok: true };
}
