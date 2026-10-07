import { NextResponse } from "next/server";
import { COUNCIL_OFFICER } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import type { TransferStep } from "@/lib/council-transfers/progress";
import { loadTransferProgress } from "@/lib/council-transfers/progress-server";
import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import { db } from "@/lib/db/client";

// A Council Officer's own transfers as status steps only: submitted,
// received by the shelter, then the linked animal's milestones and
// outcome. No internal medical, behaviour or owner detail.
export async function GET() {
  const auth = await requireRole(COUNCIL_OFFICER);
  if (auth instanceof Response) return auth;
  const transfers = (await db.orm.CouncilTransferSubmission.where({ submittedByEmail: auth.email }).all()).map(toCouncilTransferSubmission);
  const progress = await loadTransferProgress(transfers);
  const result: Record<string, TransferStep[]> = {};
  for (const t of transfers) result[t.id] = progress.get(t.id)!.steps;
  return NextResponse.json({ ok: true, transfers: result });
}
