import { NextResponse } from "next/server";
import { COUNCIL_OFFICER } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import { db } from "@/lib/db/client";
import type { StepState } from "@/lib/process/engine";

// A Council Officer's own transfers as a status summary only (PRD 9:
// "own transfer status summary") - submitted, received by the shelter,
// in care, outcome. No internal medical, behaviour or owner detail.
type TransferStep = { label: string; state: StepState; detail: string; waitingOn?: string };

const OUTCOME: Partial<Record<string, string>> = {
  "Available For Adoption": "Available for adoption",
  "Application In Progress": "Adoption in progress",
  "Awaiting Release": "Adopted - awaiting release",
  inFollowUpPeriod: "Adopted",
  Rehomed: "Adopted",
  "Reclaimed By Owner": "Returned to owner",
  ReturnedToOwner: "Returned to owner",
  Archived: "Not suitable for adoption",
};

export async function GET() {
  const auth = await requireRole(COUNCIL_OFFICER);
  if (auth instanceof Response) return auth;
  const [transferRows, intakes] = await Promise.all([
    db.orm.CouncilTransferSubmission.where({ submittedByEmail: auth.email }).all(),
    db.orm.IntakeRecord.select("intakeId", "animalId", "councilTransferSubmissionId", "finalisedAt").all(),
  ]);
  const transfers = transferRows.map(toCouncilTransferSubmission);
  const intakeByTransfer = new Map(intakes.filter((i) => i.councilTransferSubmissionId).map((i) => [i.councilTransferSubmissionId!, i]));
  const animalIds = [...new Set(transfers.map((t) => intakeByTransfer.get(t.id)?.animalId).filter((id): id is string => Boolean(id)))];
  const animals = animalIds.length
    ? (await Promise.all(animalIds.map((animalId) => db.orm.Animal.select("animalId", "currentStatus").where({ animalId }).first()))).filter(Boolean)
    : [];
  const statusById = new Map(animals.map((a) => [a!.animalId, a!.currentStatus]));

  const result: Record<string, TransferStep[]> = {};
  for (const t of transfers) {
    const intake = intakeByTransfer.get(t.id);
    const animalStatus = intake?.finalisedAt ? statusById.get(intake.animalId) : undefined;
    const submitted = t.status !== "Draft";
    const received = t.status === "Accepted" || Boolean(intake);
    const outcome = animalStatus ? OUTCOME[animalStatus] : undefined;
    result[t.id] = [
      { label: "Submitted", state: submitted ? "done" : "in_progress", detail: submitted ? "Submitted to the shelter" : "Draft - not submitted yet", waitingOn: submitted ? undefined : "Council Officer" },
      { label: "Received by shelter", state: received ? "done" : submitted ? "waiting" : "not_started", detail: received ? "Received by the shelter" : "Waiting for the shelter", waitingOn: received || !submitted ? undefined : "Shelter Staff" },
      { label: "In shelter care", state: animalStatus ? "done" : received ? "in_progress" : "not_started", detail: animalStatus ? "Animal admitted" : received ? "Intake in progress" : "Not admitted yet", waitingOn: received && !animalStatus ? "Shelter Staff" : undefined },
      { label: "Outcome", state: outcome ? "done" : animalStatus ? "in_progress" : "not_started", detail: outcome ?? (animalStatus ? "In care" : "Not decided yet") },
    ];
  }
  return NextResponse.json({ ok: true, transfers: result });
}
