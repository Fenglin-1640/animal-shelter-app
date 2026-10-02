import { CHECK_TYPES, type CheckOutcome, type SuitabilityCheck } from "@/lib/checks/types";
import { getJson, send } from "@/lib/shared/http";

// FR-CHK-01: SuitabilityCheck now lives in the database (see
// prisma/contract.prisma) behind /api/checks - see prisma/README.md for
// this Prisma toolchain's quirks.

async function fetchAll(): Promise<SuitabilityCheck[]> {
  const result = await getJson("/api/checks");
  return result.items as SuitabilityCheck[];
}

function generateCheckId(): string {
  return `CHK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// "每个已提交的 AdoptionApplication 必须自动建立三条 SuitabilityCheck" - called once,
// right after submitApplication() succeeds. Idempotent (a no-op if
// checks already exist for this application).
export async function createChecksForApplication(applicationId: string): Promise<void> {
  const all = await fetchAll();
  if (all.some((c) => c.applicationId === applicationId)) return;
  for (const checkType of CHECK_TYPES) {
    const check: SuitabilityCheck = {
      checkId: generateCheckId(),
      applicationId,
      checkType,
      outcome: "Pending",
      checkNotes: "",
    };
    await send("/api/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(check),
    });
  }
}

export async function listChecksForApplication(applicationId: string): Promise<SuitabilityCheck[]> {
  const all = await fetchAll();
  return all.filter((c) => c.applicationId === applicationId);
}

export async function allChecksComplete(applicationId: string): Promise<boolean> {
  const checks = await listChecksForApplication(applicationId);
  return checks.length === CHECK_TYPES.length && checks.every((c) => c.outcome !== "Pending");
}

export async function allChecksPass(applicationId: string): Promise<boolean> {
  const checks = await listChecksForApplication(applicationId);
  return (
    checks.length === CHECK_TYPES.length &&
    checks.every((c) => c.outcome !== "Pending") &&
    checks.every((c) => c.outcome === "Pass")
  );
}

export type MutationResult = { ok: true } | { ok: false; reason: string };

export async function completeCheck(
  checkId: string,
  outcome: Exclude<CheckOutcome, "Pending">,
  checkNotes: string,
  conductedDate: string,
  email: string,
  name: string,
): Promise<MutationResult> {
  const check = (await fetchAll()).find((c) => c.checkId === checkId);
  if (!check) return { ok: false, reason: "not_found" };
  if (check.outcome !== "Pending") return { ok: false, reason: "already_completed" };

  const response = await send(`/api/checks/${checkId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outcome,
      checkNotes,
      conductedDate,
      completedByEmail: email,
      completedByName: name,
    }),
  });
  const result = await response.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };
  return { ok: true };
}
