import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toVaccinationRecord } from "@/lib/medical/serialize";
import type { VaccinationRecord } from "@/lib/medical/types";

export async function GET() {
  const rows = await db.orm.VaccinationRecord.where({}).all();
  return NextResponse.json({ items: rows.map(toVaccinationRecord) });
}

export async function POST(request: Request) {
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
    createdAt: new Date(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toVaccinationRecord(created) });
}
