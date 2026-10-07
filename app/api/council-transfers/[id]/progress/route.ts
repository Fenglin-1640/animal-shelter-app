import { NextResponse } from "next/server";
import { COUNCIL_OFFICER } from "@/lib/auth/api-roles";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { loadTransferProgress } from "@/lib/council-transfers/progress-server";
import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import { db } from "@/lib/db/client";

// One of the Council Officer's own transfers with the linked animal's
// progress (whitelisted summary and milestones). Another officer's
// transfer is refused.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(COUNCIL_OFFICER);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const row = await db.orm.CouncilTransferSubmission.where({ id }).first();
  if (!row) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (row.submittedByEmail.toLowerCase() !== auth.email.toLowerCase()) return forbidden();
  const transfer = toCouncilTransferSubmission(row);
  const progress = (await loadTransferProgress([transfer])).get(id)!;
  return NextResponse.json({ ok: true, transfer, ...progress });
}
