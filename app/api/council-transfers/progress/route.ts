import { NextResponse } from "next/server";
import { COUNCIL_OFFICER } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import type { TransferWithProgress } from "@/lib/council-transfers/progress";
import { loadTransferProgress } from "@/lib/council-transfers/progress-server";
import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import { db } from "@/lib/db/client";

// Everything the Council Officer's My Transfers list shows, in one call:
// their own transfers, each with its status steps and the linked animal's
// summary (whitelisted fields only, thumbnail as a signed image URL).
export async function GET() {
  const auth = await requireRole(COUNCIL_OFFICER);
  if (auth instanceof Response) return auth;
  const transfers = (await db.orm.CouncilTransferSubmission.where({ submittedByEmail: auth.email }).all()).map(toCouncilTransferSubmission);
  const progress = await loadTransferProgress(transfers);
  const items: TransferWithProgress[] = transfers.map((transfer) => ({ transfer, ...progress.get(transfer.id)! }));
  return NextResponse.json({ ok: true, items });
}
