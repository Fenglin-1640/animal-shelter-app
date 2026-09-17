import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toPreReleaseCheck } from "@/lib/medical/serialize";
import type { PreReleaseCheck } from "@/lib/medical/types";

export async function GET() {
  const rows = await db.orm.PreReleaseCheck.where({}).all();
  return NextResponse.json({ items: rows.map(toPreReleaseCheck) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as PreReleaseCheck;
  const created = await db.orm.PreReleaseCheck.create({
    id: body.id,
    animalId: body.animalId,
    checkDate: body.checkDate,
    fitnessResult: body.fitnessResult,
    healthFindings: body.healthFindings,
    medicationGuidance: body.medicationGuidance,
    careInstructions: body.careInstructions,
    veterinarianEmail: body.veterinarianEmail,
    veterinarianName: body.veterinarianName,
    createdAt: new Date(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toPreReleaseCheck(created) });
}
