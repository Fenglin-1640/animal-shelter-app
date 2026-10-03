import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toVaccinationRecord } from "@/lib/medical/serialize";
import type { VaccinationRecord } from "@/lib/medical/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, VETERINARIAN } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.VaccinationRecord.where({}).all();
  return NextResponse.json({ items: rows.map(toVaccinationRecord) });
}

export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as VaccinationRecord;
  const created = await db.orm.VaccinationRecord.create({
    id: body.id,
    animalId: body.animalId,
    vaccineType: body.vaccineType,
    administrationDate: body.administrationDate,
    doseOrChipId: body.doseOrChipId,
    nextBoosterDueDate: body.nextBoosterDueDate,
    veterinarianEmail: body.veterinarianEmail,
    veterinarianName: body.veterinarianName,
    createdAt: toTimestamptz(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toVaccinationRecord(created) });
}
