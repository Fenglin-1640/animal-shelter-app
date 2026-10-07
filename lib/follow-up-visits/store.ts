import { changeAnimalStatus } from "@/lib/animals/animal-store";
import { writeAuditLog } from "@/lib/audit/store";
import type { FollowUpType, FollowUpVisit, WelfareOutcome } from "@/lib/follow-up-visits/types";
import { getJson, send } from "@/lib/shared/http";

// FR-REL-02: FollowUpVisit now lives in the database (see
// prisma/contract.prisma) behind /api/follow-up-visits - see
// prisma/README.md for this Prisma toolchain's quirks.

async function fetchAll(): Promise<FollowUpVisit[]> {
  const result = await getJson("/api/follow-up-visits");
  return result.items as FollowUpVisit[];
}

export async function listFollowUpVisitsForAnimal(animalId: string): Promise<FollowUpVisit[]> {
  return (await fetchAll())
    .filter((v) => v.animalId === animalId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// The state machine (Awaiting Release -> inFollowUpPeriod -> Rehomed, a
// named final state) means an Animal can only ever go through this once,
// so there is at most one FollowUpVisit per animal - but read the latest
// defensively rather than assuming exactly one.
export async function getLatestFollowUpVisitForAnimal(animalId: string): Promise<FollowUpVisit | undefined> {
  return (await listFollowUpVisitsForAnimal(animalId))[0];
}

export async function getFollowUpVisit(followUpVisitId: string): Promise<FollowUpVisit | undefined> {
  return (await fetchAll()).find((v) => v.followUpVisitId === followUpVisitId);
}

export async function listActiveFollowUpVisits(): Promise<FollowUpVisit[]> {
  return (await fetchAll())
    .filter((v) => v.status === "Scheduled")
    .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
}

export async function listMyFollowUpVisits(email: string): Promise<FollowUpVisit[]> {
  const normalized = email.trim().toLowerCase();
  return (await fetchAll())
    .filter((v) => v.adopterEmail.toLowerCase() === normalized)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type MutationResult = { ok: true } | { ok: false; reason: string; message?: string };

export interface ReleaseInput {
  careInstructionsProvided: boolean;
  releaseDate: string;
  receivingAdopter: string;
  targetDate: string;
  followUpType: FollowUpType;
  handoverNotes?: string;
}

// Release to Adopter (Shelter Staff Member or Administrator). The server
// checks the animal is Awaiting Release with a Fit for Release Pre-Release
// Check, then in one transaction sets it to inFollowUpPeriod, schedules the
// Follow-Up Visit for the finalised Adopter and writes the audit entries
// as the signed-in user.
export async function releaseAnimal(
  animalId: string,
  input: ReleaseInput,
): Promise<{ ok: true; visit: FollowUpVisit } | { ok: false; reason: string; message?: string }> {
  const response = await send("/api/follow-up-visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ animalId, ...input }),
  });
  const result = (await response.json().catch(() => ({ ok: false, reason: "error" }))) as {
    ok: boolean;
    reason?: string;
    message?: string;
    item?: FollowUpVisit;
  };
  if (!result.ok || !result.item) return { ok: false, reason: result.reason ?? "error", message: result.message };
  return { ok: true, visit: result.item };
}

// Completing the Follow-Up Visit with a welfare outcome moves the animal to
// Rehomed. Shelter Staff Member and Administrator.
export async function completeFollowUpVisit(
  followUpVisitId: string,
  outcome: WelfareOutcome,
  outcomeNotes: string,
  actorEmail: string,
  actorName: string,
): Promise<MutationResult> {
  const visit = await getFollowUpVisit(followUpVisitId);
  if (!visit) return { ok: false, reason: "not_found" };
  if (visit.status !== "Scheduled") return { ok: false, reason: "already_completed" };

  const now = new Date().toISOString();
  const response = await send(`/api/follow-up-visits/${followUpVisitId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "Completed",
      outcome,
      outcomeNotes,
      completedByEmail: actorEmail,
      completedByName: actorName,
      completedAt: now,
    }),
  });
  const result = await response.json();
  if (!result.ok) return { ok: false, reason: result.reason ?? "not_found" };

  const statusResult = await changeAnimalStatus(
    visit.animalId,
    { currentStatus: "Rehomed", statusUpdatedAt: now },
    { email: actorEmail, name: actorName },
    "Complete Follow Up Visit",
  );
  if (!statusResult.ok) return { ok: false, reason: statusResult.reason };

  await writeAuditLog({
    userId: actorEmail,
    userName: actorName,
    action: "Complete Follow Up Visit",
    entityType: "FollowUpVisit",
    entityId: followUpVisitId,
    oldValue: "status=Scheduled",
    newValue: `status=Completed, outcome=${outcome}`,
    result: "Success",
  });

  return { ok: true };
}
