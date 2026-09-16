import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  const current = await db.orm.User.where({ id }).first();
  if (!current || current.password !== currentPassword) {
    return NextResponse.json({ ok: false, reason: "incorrect_current_password" });
  }

  await db.orm.User.where({ id }).update({ password: newPassword });
  return NextResponse.json({ ok: true });
}
