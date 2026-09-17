import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toMeetAndGreet, toMeetAndGreetRowPatch } from "@/lib/meet-and-greets/serialize";
import type { MeetAndGreet } from "@/lib/meet-and-greets/types";

// Generic patch - mirrors AdoptionApplication's PATCH route. Every call
// site (selectSlot, confirmAttendance, recordOutcome) just patches a
// different subset of fields; business-rule checks (not_found,
// slot_not_found, reason_required) stay client-side in
// lib/meet-and-greets/store.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const patch = (await request.json()) as Partial<MeetAndGreet>;

  const updated = await db.orm.MeetAndGreet.where({ meetAndGreetId: id }).update(
    toMeetAndGreetRowPatch(patch),
  );
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toMeetAndGreet(updated) });
}
