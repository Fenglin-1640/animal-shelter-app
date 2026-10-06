import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toVaccinationRecord } from "@/lib/medical/serialize";
import type { VaccinationRecord } from "@/lib/medical/types";
import { requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, VETERINARIAN } from "@/lib/auth/api-roles";
import { recordVaccinationBatch } from "@/lib/medical/vaccination-server";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.VaccinationRecord.where({}).all();
  return NextResponse.json({ items: rows.map(toVaccinationRecord) });
}

// One vaccination: the same rules as POST /api/medical/vaccinations/batch
// (species, antibody reason, pending item), as a batch of one.
export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as VaccinationRecord & { vaccinationTaskId?: string };
  return recordVaccinationBatch(auth, {
    animalId: body.animalId,
    administrationDate: body.administrationDate,
    items: [
      {
        vaccineType: body.vaccineType,
        doseOrChipId: body.doseOrChipId,
        nextBoosterDueDate: body.nextBoosterDueDate,
        antibodyOverrideReason: body.antibodyOverrideReason,
        antibodyOverrideNote: body.antibodyOverrideNote,
        vaccinationTaskId: body.vaccinationTaskId,
      },
    ],
  });
}
