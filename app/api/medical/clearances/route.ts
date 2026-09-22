import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toMedicalClearance } from "@/lib/medical/serialize";
import type { MedicalClearance } from "@/lib/medical/types";
import { toTimestamptz } from "@/lib/db/temporal";

export async function GET() {
  const rows = await db.orm.MedicalClearance.where({}).all();
  return NextResponse.json({ items: rows.map(toMedicalClearance) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as MedicalClearance;
  const created = await db.orm.MedicalClearance.create({
    id: body.id,
    animalId: body.animalId,
    issuedByEmail: body.issuedByEmail,
    issuedByName: body.issuedByName,
    issuedAt: toTimestamptz(body.issuedAt),
  });
  return NextResponse.json({ ok: true, item: toMedicalClearance(created) });
}
