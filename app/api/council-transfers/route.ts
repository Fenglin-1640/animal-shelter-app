import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toCouncilTransferSubmission } from "@/lib/council-transfers/serialize";
import type { CouncilTransferSubmission } from "@/lib/council-transfers/types";
import { toTimestamptz } from "@/lib/db/temporal";

export async function GET() {
  const rows = await db.orm.CouncilTransferSubmission.where({}).all();
  return NextResponse.json({ items: rows.map(toCouncilTransferSubmission) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CouncilTransferSubmission;
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
