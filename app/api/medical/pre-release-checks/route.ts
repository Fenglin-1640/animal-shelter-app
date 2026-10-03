import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toPreReleaseCheck } from "@/lib/medical/serialize";
import type { PreReleaseCheck } from "@/lib/medical/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, VETERINARIAN } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.PreReleaseCheck.where({}).all();
  return NextResponse.json({ items: rows.map(toPreReleaseCheck) });
}

export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
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
    createdAt: toTimestamptz(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toPreReleaseCheck(created) });
}
