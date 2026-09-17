import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toBehaviourProgram } from "@/lib/behaviour/serialize";

// resolveProgram(): marks a Behaviour Program Completed - Suitable /
// Completed - Permanently Unsuitable. Not_found is handled client-side
// (lib/behaviour/store.ts already has the program's id in hand from its
// own read), matching how Medical's desexing-schedule PATCH works.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { status: string; resolvedAt: string };

  const updated = await db.orm.BehaviourProgram.where({ id }).update({
    status: body.status,
    resolvedAt: new Date(body.resolvedAt),
  });
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toBehaviourProgram(updated) });
}
