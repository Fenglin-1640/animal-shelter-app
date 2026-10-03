import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toMeetAndGreet } from "@/lib/meet-and-greets/serialize";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";
import { toTimestamptz } from "@/lib/db/temporal";
import { requireRole } from "@/lib/auth/server-session";
import { ADOPTER, CARE_TEAM, isOwnRecord, seesAllRecords, STAFF } from "@/lib/auth/api-roles";

export async function GET() {
  const auth = await requireRole([...CARE_TEAM, ...ADOPTER]);
  if (auth instanceof Response) return auth;
  const rows = await db.orm.MeetAndGreet.where({}).all();
  // Adopters see only their own records; the care team sees all.
  const items = rows.map(toMeetAndGreet).filter((item) => seesAllRecords(auth.role) || isOwnRecord(auth, item.adopterEmail));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireRole(STAFF);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as MeetAndGreet;
  const created = await db.orm.MeetAndGreet.create({
    meetAndGreetId: body.meetAndGreetId,
    applicationId: body.applicationId,
    animalId: body.animalId,
    animalName: body.animalName,
    animalSpecies: body.animalSpecies,
    adopterEmail: body.adopterEmail,
    adopterName: body.adopterName,
    slotOptions: JSON.stringify(body.slotOptions),
    selectedSlotId: body.selectedSlotId ?? null,
    scheduledDate: body.scheduledDate ?? null,
    location: body.location ?? null,
    participants: body.participants,
    staffNotes: body.staffNotes,
    status: body.status,
    attendanceConfirmed: body.attendanceConfirmed ? 1 : 0,
    outcome: body.outcome ?? null,
    outcomeReason: body.outcomeReason ?? null,
    createdByEmail: body.createdByEmail,
    createdByName: body.createdByName,
    createdAt: toTimestamptz(body.createdAt),
    updatedAt: toTimestamptz(body.updatedAt),
  });
  return NextResponse.json({ ok: true, item: toMeetAndGreet(created) });
}
