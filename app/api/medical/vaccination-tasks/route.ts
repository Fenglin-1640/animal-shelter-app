import { NextResponse } from "next/server";
import { CARE_TEAM } from "@/lib/auth/api-roles";
import { requireRole } from "@/lib/auth/server-session";
import { db } from "@/lib/db/client";
import { toVaccinationTask } from "@/lib/medical/vaccination-check";

// Vaccination items from vaccination checks. ?animalId= narrows the list.
export async function GET(request: Request) {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const animalId = new URL(request.url).searchParams.get("animalId");
  const rows = await db.orm.VaccinationTask.where(animalId ? { animalId } : {}).all();
  return NextResponse.json({ items: rows.map(toVaccinationTask) });
}
