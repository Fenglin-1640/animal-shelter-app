import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

// FR-UA-02: Administrator unlocks an account after 6 failed sign-in
// attempts (PRD 4.1).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const current = await db.orm.User.where({ id }).first();
  if (!current) {
    return NextResponse.json({ ok: false, reason: "not_found" });
  }

  await db.orm.User.where({ id }).update({ failedLoginAttempts: 0, lockedAt: null });
  return NextResponse.json({ ok: true });
}
