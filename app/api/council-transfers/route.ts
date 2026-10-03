import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { forbidden, requireRole } from "@/lib/auth/server-session";
import { COUNCIL_OFFICER, isOwnRecord, STAFF } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole([...STAFF, ...COUNCIL_OFFICER]);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.CouncilTransferSubmission.where({}).all();
  // A Council Officer sees only their own submissions (PRD 9: "创建并查看本人").
  const items = rows
    .map(toCouncilTransferSubmission)
    .filter((t) => auth.role !== "Council Animal Control Officer" || isOwnRecord(auth, t.submittedByEmail));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireRole(COUNCIL_OFFICER);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as CouncilTransferSubmission;
  if (!isOwnRecord(auth, body.submittedByEmail)) return forbidden();
  const created = await db.orm.CouncilTransferSubmission.create({
    id: body.id,
    submittedByEmail: body.submittedByEmail,
    submittedByName: body.submittedByName,
    source: body.source,
    arrivalCircumstance: body.arrivalCircumstance,
    foundLocation: body.foundLocation,
    animalDescription: body.animalDescription,
    attachments: JSON.stringify(body.attachments),
    status: body.status,
    submissionDate: toTimestamptz(body.submissionDate ?? null),
    createdAt: toTimestamptz(body.createdAt),
    updatedAt: toTimestamptz(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toCouncilTransferSubmission(created) });
}
