import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toDesexingSchedule } from "@/lib/medical/serialize";

// Mark Desexing Completed. Business-rule checks (already_completed,
// not_found) stay client-side in lib/medical/store.ts, matching how
// Animal's generic PATCH route works - see app/api/animals/[id]/route.ts.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    status: string;
    completedAt: string;
    completedByEmail: string;
    completedByName: string;
  };

  const updated = await db.orm.DesexingSchedule.where({ id }).update({
    status: body.status,
    completedAt: new Date(body.completedAt),
    completedByEmail: body.completedByEmail,
    completedByName: body.completedByName,
  });
  if (!updated) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: toDesexingSchedule(updated) });
}
