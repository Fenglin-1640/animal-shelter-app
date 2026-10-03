import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDesexingSchedule } from "@/lib/medical/serialize";
import type { DesexingSchedule } from "@/lib/medical/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { CARE_TEAM, VETERINARIAN } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole(CARE_TEAM);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.DesexingSchedule.where({}).all();
  return NextResponse.json({ items: rows.map(toDesexingSchedule) });
}

export async function POST(request: Request) {
  const auth = await requireRole(VETERINARIAN);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as DesexingSchedule;
  const created = await db.orm.DesexingSchedule.create({
    id: body.id,
    animalId: body.animalId,
    scheduledDate: body.scheduledDate,
    status: body.status,
    completedAt: toTimestamptz(body.completedAt ?? null),
    completedByEmail: body.completedByEmail ?? null,
    completedByName: body.completedByName ?? null,
    veterinarianEmail: body.veterinarianEmail,
    veterinarianName: body.veterinarianName,
    createdAt: toTimestamptz(body.createdAt),
  });
  return NextResponse.json({ ok: true, item: toDesexingSchedule(created) });
}
