import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toTemperamentAssessment } from "@/lib/behaviour/serialize";
import type { TemperamentAssessment } from "@/lib/behaviour/types";
import { toTimestamptz } from "@/lib/db/temporal";

export async function GET() {
  const rows = await db.orm.TemperamentAssessment.where({}).all();
  return NextResponse.json({ items: rows.map(toTemperamentAssessment) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as TemperamentAssessment;
  const created = await db.orm.TemperamentAssessment.create({
    id: body.id,
    animalId: body.animalId,
    handlingResponse: body.handlingResponse,
    reactionToStrangers: body.reactionToStrangers,
    foodBehaviour: body.foodBehaviour,
    interactionWithOtherAnimals: body.interactionWithOtherAnimals,
    socialisationScore: body.socialisationScore,
    observations: body.observations,
    recommendations: body.recommendations,
    assessmentDate: body.assessmentDate,
    assessorEmail: body.assessorEmail,
    assessorName: body.assessorName,
    followUpRequired: body.followUpRequired ? 1 : 0,
    reassessmentDate: body.reassessmentDate ?? null,
    outcome: body.outcome,
    createdAt: toTimestamptz(body.createdAt),
    programReassessmentOf: body.programReassessmentOf ?? null,
  });
  return NextResponse.json({ ok: true, item: toTemperamentAssessment(created) });
}
